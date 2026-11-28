-- The whole client store, idempotent: run it in the Supabase SQL editor on a
-- new project or an existing one (production and the separate test project
-- alike). Every statement is safe to re-run.
--
-- Access is service-role only: RLS is on and no policies exist, so nothing but
-- the server's SUPABASE_SERVICE_ROLE_KEY can read or write these tables.

-- One row = one project. The email is the person, and one person can hold
-- several projects (an engagement and a wedding, say), so the email index is
-- not unique. Capture matches on email + service to decide insert vs. update.
create table if not exists client_records (
  id uuid primary key default gen_random_uuid(),
  client_name text,
  email text not null,
  phone text,
  partner_name text,
  status text not null default 'new-inquiry',
  service_type text,
  package text,
  bundle_id uuid,
  bundle_label text,
  gallery_url text,
  project_name text,
  source text default 'manual',
  event_date text,
  secondary_dates jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  guest_count integer,
  budget text,
  plan_summary text,
  client_notes text,
  client_notes_reply text,
  questionnaire_snapshot text,
  documents jsonb not null default '[]'::jsonb,
  inquiry_message text,
  referral text,
  status_history jsonb not null default '[]'::jsonb,
  last_client_update timestamptz,
  internal_notes text,
  collaborators jsonb not null default '[]'::jsonb,
  collaborator_emails text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns added after the table first shipped. `create table if not exists`
-- skips an existing table, so these bring an older one up to date.
alter table client_records add column if not exists bundle_id uuid;
alter table client_records add column if not exists bundle_label text;
alter table client_records add column if not exists gallery_url text;
alter table client_records add column if not exists project_name text;
alter table client_records add column if not exists client_notes text;
alter table client_records add column if not exists client_notes_reply text;
alter table client_records add column if not exists collaborators jsonb not null default '[]'::jsonb;
alter table client_records add column if not exists collaborator_emails text[] not null default '{}';

-- An early version made the email index unique. Dropping and recreating it on
-- every run keeps it non-unique, and costs nothing at this table's size.
drop index if exists client_records_email_idx;
create index if not exists client_records_email_idx on client_records (lower(email));
create index if not exists client_records_bundle_idx on client_records (bundle_id);
-- Second-photographer access: which projects has this email been granted?
create index if not exists client_records_collab_emails_idx
  on client_records using gin (collaborator_emails);

alter table client_records enable row level security;

-- Reviewed portfolio alt text, overlaid on the import-generated baseline at
-- render. Optional: galleries fall back to the manifest alt without it.
create table if not exists portfolio_image_alt (
  src text primary key,
  alt text not null,
  updated_at timestamptz not null default now()
);
alter table portfolio_image_alt enable row level security;

-- Every message to or from a client, one thread per project: emails the site
-- sends, delivery events, replies received through the reply address, and
-- messages posted in the client portal.
create table if not exists client_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references client_records (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  channel text not null default 'email' check (channel in ('email', 'portal')),
  -- compose | update | confirmation | relay | reply | portal | imported | inquiry
  kind text not null,
  from_addr text,
  to_addr text,
  subject text,
  body_text text,
  resend_id text unique,
  message_id text,
  in_reply_to text,
  idempotency_key text unique,
  -- sent | delivered | delayed | bounced | complained | failed | received |
  -- unverified | dropped
  status text not null default 'sent',
  status_detail text,
  attachments jsonb not null default '[]'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists client_messages_project_idx
  on client_messages (project_id, sent_at);
alter table client_messages enable row level security;

-- The secret in each project's reply address (reply+<token>@...). One per
-- project, so a reply to an old message still lands on the right thread.
alter table client_records add column if not exists reply_token text;
create unique index if not exists client_records_reply_token_idx
  on client_records (reply_token);

-- Small key/value settings the site keeps for itself (the AI model choice,
-- the last known state of each automation, the day a daily email went).
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

-- Portal notes and the owner's reply to them used to live on the record. They
-- now belong to the thread; this copies any existing ones over once.
insert into client_messages (project_id, direction, channel, kind, body_text, status, sent_at)
select r.id, 'in', 'portal', 'portal', r.client_notes, 'received', coalesce(r.last_client_update, r.updated_at)
from client_records r
where coalesce(trim(r.client_notes), '') <> ''
  and not exists (
    select 1 from client_messages m
    where m.project_id = r.id and m.kind = 'portal' and m.body_text = r.client_notes
  );
insert into client_messages (project_id, direction, channel, kind, body_text, status, sent_at)
select r.id, 'out', 'portal', 'portal', r.client_notes_reply, 'sent', r.updated_at
from client_records r
where coalesce(trim(r.client_notes_reply), '') <> ''
  and not exists (
    select 1 from client_messages m
    where m.project_id = r.id and m.kind = 'portal' and m.body_text = r.client_notes_reply
  );

-- Follow-ups, the date hold and how the client will pay. One next follow-up
-- per project; the hold is the day a held date opens again.
alter table client_records add column if not exists follow_up_at date;
alter table client_records add column if not exists follow_up_note text;
alter table client_records add column if not exists hold_until date;
-- square | cash | zelle | venmo | apple-pay
alter table client_records add column if not exists payment_method text;
create index if not exists client_records_follow_up_idx
  on client_records (follow_up_at) where follow_up_at is not null;

-- When each side last wrote, per project: the client's newest message in
-- (received, so not an out-of-office notice or mail held from an unknown
-- sender, and the client's own: a portal post, a repeat inquiry, or mail from
-- the address on the project, never a vendor's or a second photographer's
-- that Julian filed), and the owner's newest one out that actually went
-- (composed here, answered from Gmail, filed from Gmail, or a reply posted in
-- the portal). Automatic emails don't count as the owner writing. Matches
-- isConversation in src/lib/messages.ts. security_invoker keeps the view under
-- the tables' row-level security, so it opens nothing the tables don't.
create or replace view client_last_contact with (security_invoker = true) as
select
  m.project_id,
  max(m.sent_at) filter (
    where m.direction = 'in'
      and m.status = 'received'
      and (
        m.channel = 'portal'
        or m.kind = 'inquiry'
        or lower(trim(coalesce(substring(m.from_addr from '<([^>]+)>'), m.from_addr))) = lower(trim(r.email))
      )
  ) as last_in_at,
  max(m.sent_at) filter (
    where m.direction = 'out'
      and m.kind in ('compose', 'relay', 'imported', 'portal')
      and m.status in ('sent', 'delivered', 'delayed')
  ) as last_out_at
from client_messages m
join client_records r on r.id = m.project_id
group by m.project_id;
revoke all on client_last_contact from public, anon, authenticated;

-- Links and files on a project (the documents array) change through these
-- functions, one statement each, so two saves at once can't overwrite each
-- other the way read-then-write would. Entries are matched by their id.
create or replace function add_document(p_id uuid, p_doc jsonb)
returns void language sql as $$
  update client_records
  set documents = documents || jsonb_build_array(p_doc), updated_at = now()
  where id = p_id
$$;

-- Removing a gallery entry also clears the retired gallery_url column, so the
-- copy further down can't bring the link back on a later run of this file.
create or replace function remove_document(p_id uuid, p_doc_id text)
returns void language sql as $$
  update client_records
  set documents = coalesce(
        (select jsonb_agg(d order by ord)
         from jsonb_array_elements(documents) with ordinality as t(d, ord)
         where d->>'id' is distinct from p_doc_id),
        '[]'::jsonb),
      gallery_url = case when exists (
          select 1 from jsonb_array_elements(documents) d
          where d->>'id' = p_doc_id and d->>'type' = 'gallery')
        then null else gallery_url end,
      updated_at = now()
  where id = p_id
$$;

-- Merges p_patch into one entry; a null in the patch clears that key.
create or replace function patch_document(p_id uuid, p_doc_id text, p_patch jsonb)
returns void language sql as $$
  update client_records
  set documents = coalesce(
        (select jsonb_agg(
           case when d->>'id' = p_doc_id then jsonb_strip_nulls(d || p_patch) else d end
           order by ord)
         from jsonb_array_elements(documents) with ordinality as t(d, ord)),
        '[]'::jsonb),
      updated_at = now()
  where id = p_id
$$;

revoke execute on function add_document(uuid, jsonb) from public, anon, authenticated;
revoke execute on function remove_document(uuid, text) from public, anon, authenticated;
revoke execute on function patch_document(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function add_document(uuid, jsonb) to service_role;
grant execute on function remove_document(uuid, text) to service_role;
grant execute on function patch_document(uuid, text, jsonb) to service_role;

-- Entries saved before ids existed get one. The release before this one keeps
-- adding entries without an id until the new one is live, so this file is run
-- once more right after that deploy.
update client_records r
set documents = (
  select jsonb_agg(
    case when d ? 'id' then d
         else d || jsonb_build_object('id', gen_random_uuid()::text) end
    order by ord)
  from jsonb_array_elements(r.documents) with ordinality as t(d, ord))
where jsonb_typeof(r.documents) = 'array'
  and exists (
    select 1 from jsonb_array_elements(r.documents) d where not (d ? 'id'));

-- The gallery link used to be its own column. It is now a 'gallery' entry in
-- the documents array; this copies an existing one over. A project qualifies
-- again only while the column still holds a link that was never removed.
update client_records r
set documents = r.documents || jsonb_build_array(jsonb_build_object(
  'id', gen_random_uuid()::text,
  'type', 'gallery',
  'label', 'Gallery',
  'url', trim(r.gallery_url),
  'uploadedBy', 'julian',
  'uploadedAt', to_char(r.updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
where coalesce(trim(r.gallery_url), '') <> ''
  and not exists (
    select 1 from jsonb_array_elements(r.documents) d where d->>'type' = 'gallery');

-- Tell the API layer about the new columns and functions straight away.
notify pgrst, 'reload schema';

-- What the AI tools worked out for a project (the inquiry assessment, the
-- shoot brief), saved so the project page shows it without asking again. Keyed
-- by kind; each entry carries its result and when it was made. Owner-only,
-- like the rest of the row.
alter table client_records add column if not exists ai_results jsonb not null default '{}'::jsonb;

-- Saves one kind without touching the others, so two saves at once can't
-- overwrite each other. Doesn't change updated_at: an assessment isn't an edit
-- to the project.
create or replace function save_ai_result(p_id uuid, p_kind text, p_result jsonb)
returns void language sql as $$
  update client_records
  set ai_results = jsonb_set(coalesce(ai_results, '{}'::jsonb), array[p_kind], p_result)
  where id = p_id
$$;
revoke execute on function save_ai_result(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function save_ai_result(uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';

-- Notes from calls with the client, keyed by call ("discovery"): the answers
-- typed under each question of the guide, free notes, and the summary written
-- after the call. Owner-only, like the rest of the row.
alter table client_records add column if not exists calls jsonb not null default '{}'::jsonb;

-- Merges a patch into one call: the answers and the questions they were typed
-- under key by key, the held time kept once set, everything else replaced, so
-- two autosaves landing together each keep what they wrote. With p_base (the
-- savedAt the patch was typed against, '' for never saved) it lands only if
-- nothing was saved since, or if the last save came from the same copy
-- (p_writer, matched against the savedBy the patch stamps) and this one isn't
-- earlier in its order (p_seq, against savedSeq): a retry of a save whose
-- reply was lost is that copy's own, the same save arriving twice still
-- lands, a first try landing after its own retry is refused, and a copy left
-- open elsewhere can't overwrite newer notes.
-- Answers {conflict}, or {held, status}: whether the call was already marked
-- held, and the project's status. Null for no such project. Doesn't change
-- updated_at: notes aren't an edit to the project.
drop function if exists merge_call(uuid, text, jsonb);
drop function if exists merge_call(uuid, text, jsonb, text);
drop function if exists merge_call(uuid, text, jsonb, text, text);
create or replace function merge_call(
  p_id uuid,
  p_call text,
  p_patch jsonb,
  p_base text default null,
  p_writer text default null,
  p_seq int default null
)
returns jsonb language plpgsql as $$
declare
  prev jsonb;
  cur_status text;
begin
  select coalesce(calls->p_call, '{}'::jsonb), status into prev, cur_status
  from client_records where id = p_id for update;
  if not found then
    return null;
  end if;
  if p_base is not null
     and coalesce(prev->>'savedAt', '') <> p_base
     and (p_writer is null
          or p_seq is null
          or coalesce(prev->>'savedBy', '') <> p_writer
          or p_seq < coalesce((prev->>'savedSeq')::int, 0)) then
    return jsonb_build_object('conflict', true);
  end if;
  update client_records
  set calls = jsonb_set(
    coalesce(calls, '{}'::jsonb),
    array[p_call],
    prev
      || (p_patch - 'answers' - 'asked' - 'heldAt')
      || jsonb_build_object(
           'answers', coalesce(prev->'answers', '{}'::jsonb) || coalesce(p_patch->'answers', '{}'::jsonb),
           'asked', coalesce(prev->'asked', '{}'::jsonb) || coalesce(p_patch->'asked', '{}'::jsonb))
      || case
           when prev ? 'heldAt' or not p_patch ? 'heldAt' then '{}'::jsonb
           else jsonb_build_object('heldAt', p_patch->'heldAt')
         end)
  where id = p_id;
  return jsonb_build_object('conflict', false, 'held', prev ? 'heldAt', 'status', cur_status);
end
$$;
revoke execute on function merge_call(uuid, text, jsonb, text, text, int) from public, anon, authenticated;
grant execute on function merge_call(uuid, text, jsonb, text, text, int) to service_role;

notify pgrst, 'reload schema';

-- The Today list on the projects board: what the owner has marked handled, or
-- snoozed until a day, keyed by the row (the rule and what set it off, so the
-- same rule firing for something new shows again). Owner-only.
alter table client_records add column if not exists today_dismissed jsonb not null default '{}'::jsonb;

-- Marks one row: "handled", or a calendar day it stays hidden until. Doesn't
-- change updated_at: dismissing a reminder isn't an edit to the project.
create or replace function dismiss_today(p_id uuid, p_key text, p_value text)
returns void language sql as $$
  update client_records
  set today_dismissed = jsonb_set(coalesce(today_dismissed, '{}'::jsonb), array[p_key], to_jsonb(p_value))
  where id = p_id
$$;
revoke execute on function dismiss_today(uuid, text, text) from public, anon, authenticated;
grant execute on function dismiss_today(uuid, text, text) to service_role;

notify pgrst, 'reload schema';

-- The pipeline template an email was sent from, when there was one, so the
-- project page knows which steps are done (the week-of email, the sneak peek).
alter table client_messages add column if not exists template text;

-- The project's activity log (status_history): each move in the pipeline and
-- each note the owner adds, dated. Appends one entry in a single statement, so
-- a note added while something else writes the log isn't lost. Says whether
-- the project exists.
create or replace function add_activity(p_id uuid, p_entry jsonb)
returns boolean language sql as $$
  with changed as (
    update client_records
    set status_history = coalesce(status_history, '[]'::jsonb) || jsonb_build_array(p_entry),
        updated_at = now()
    where id = p_id
    returning 1
  )
  select exists (select 1 from changed)
$$;
revoke execute on function add_activity(uuid, jsonb) from public, anon, authenticated;
grant execute on function add_activity(uuid, jsonb) to service_role;

-- Moves a project to p_to, only while its status is still p_from (the status
-- it was read as), and adds p_entry to its activity log, in one statement, so
-- a note or another move landing at the same moment is kept. p_close also
-- clears the follow-up and the date hold, as closing a project does. Says
-- whether it moved.
create or replace function set_status(p_id uuid, p_from text, p_to text, p_entry jsonb, p_close boolean)
returns boolean language sql as $$
  with changed as (
    update client_records
    set status = p_to,
        status_history = coalesce(status_history, '[]'::jsonb) || jsonb_build_array(p_entry),
        follow_up_at = case when p_close then null else follow_up_at end,
        follow_up_note = case when p_close then null else follow_up_note end,
        hold_until = case when p_close then null else hold_until end,
        updated_at = now()
    where id = p_id and status is not distinct from p_from
    returning 1
  )
  select exists (select 1 from changed)
$$;
revoke execute on function set_status(uuid, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function set_status(uuid, text, text, jsonb, boolean) to service_role;

-- The private notes box is now the activity log. Notes kept in the box become
-- the log's first entry, marked as such and undated. A project qualifies again
-- only if its box holds text the log doesn't have yet; a run after the deploy
-- then replaces the earlier copy with the box's last edit, so nothing shows
-- twice.
update client_records
set status_history = jsonb_build_array(
      jsonb_build_object('kind', 'note', 'from', 'internal-notes', 'status', status, 'note', internal_notes)
    ) || coalesce(
      (select jsonb_agg(e order by i)
       from jsonb_array_elements(coalesce(status_history, '[]'::jsonb)) with ordinality as t(e, i)
       where e->>'from' is distinct from 'internal-notes'),
      '[]'::jsonb
    )
where coalesce(btrim(internal_notes), '') <> ''
  and not coalesce(status_history, '[]'::jsonb)
    @> jsonb_build_array(jsonb_build_object('from', 'internal-notes', 'note', internal_notes));

notify pgrst, 'reload schema';
