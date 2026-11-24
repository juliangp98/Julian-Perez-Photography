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
  -- compose | update | confirmation | relay | reply | portal | imported
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
-- the last known state of each automation).
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
