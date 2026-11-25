// Server-only helpers for the private client store (Supabase Postgres).
//
// One row = one PROJECT (a single service engagement); the email is the
// PERSON. A person can have several projects (e.g. engagement + wedding, or
// maternity + newborn), and two or more projects can be linked into a BUNDLE
// via a shared `bundle_id` + `bundle_label`. Lead capture matches by
// email + service so distinct services become distinct projects.
//
// PII is reached only through the service-role key — never the browser. Every
// function gates on `isClientsStoreConfigured()` and no-ops when the store
// isn't wired up, so capture + the portal degrade gracefully without env.
//
// Privacy boundary: the safe projection (`safeSelect()`) is what the portal
// lists — it omits `internal_notes`, `budget`, `status_history`, inquiry
// context, and meta timestamps, so those never reach a client. The
// questionnaire snapshot is held out of the list and layered onto the
// single-project reads: the client's own answers in full, and for a second
// photographer only the answers about the shoot. Portal reads are additionally
// scoped to the signed-in person's email (ownership); a second photographer
// reads a narrower projection still (`collaboratorSelect()`), and the admin
// dashboard sees the full row (`fullSelect()`).

import "server-only";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CLIENT_STATUS_TERMINAL,
  statusRank,
  type ClientStatus,
} from "@/lib/client-status";
import { documentType } from "@/lib/labels";
import { shootAnswers } from "@/lib/questionnaire-digest";
import type { AiResults, SavedAiKind, SavedAiResult } from "@/lib/ai-results";
import type { CallKind, CallNotes, ProjectCalls } from "@/lib/calls";

const TABLE = "client_records";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;
// Shared with the other store modules (messages.ts, settings.ts).
export function db(): SupabaseClient {
  if (!cached) {
    cached = createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export function isClientsStoreConfigured(): boolean {
  return (
    typeof url === "string" &&
    url.length > 0 &&
    typeof serviceKey === "string" &&
    serviceKey.length > 0
  );
}

// Lightweight liveness query for the keep-alive cron. A `head: true` count
// touches Postgres without transferring any rows — the cheapest real database
// hit, enough to reset Supabase's free-tier idle timer (projects auto-pause
// after ~7 days without activity). Returns the row count; throws on error so
// the caller can surface it to Sentry rather than silently no-op.
export async function pingClientsStore(): Promise<number> {
  const { count, error } = await db()
    .from(TABLE)
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// One link or file on a project. `type` is a value from DOCUMENT_TYPES
// (src/lib/labels.ts). Every entry carries an id, which is how it is removed or
// changed; `dueAt` and `paidAt` (calendar dates) are used by invoices.
export type ClientDocumentEntry = {
  id?: string;
  label: string;
  type?: string;
  url: string;
  uploadedBy?: "julian" | "client";
  uploadedAt?: string;
  dueAt?: string;
  paidAt?: string;
};
export type ClientLocationEntry = {
  label?: string;
  address?: string;
  notes?: string;
};
export type ClientDateEntry = { label?: string; date?: string };
// A second photographer (or other helper) granted per-project READ access to
// the portal. Stored as a JSONB array on the row; the parallel
// `collaborator_emails text[]` (normalized, GIN-indexed) is what the reverse
// "which projects can this email see" lookups filter on.
export type CollaboratorEntry = {
  email: string;
  name?: string;
  addedAt?: string;
};

// Portal-safe shape — what `getClientById` returns and the portal renders.
export type ClientRecordSafe = {
  id: string;
  clientName?: string;
  email?: string;
  phone?: string;
  partnerName?: string;
  status?: ClientStatus;
  serviceType?: string;
  package?: string;
  eventDate?: string;
  secondaryDates?: ClientDateEntry[];
  locations?: ClientLocationEntry[];
  guestCount?: number;
  planSummary?: string;
  documents?: ClientDocumentEntry[];
  lastClientUpdate?: string;
  bundleId?: string;
  bundleLabel?: string;
  projectName?: string;
  // How the client will pay (a PAYMENT_METHODS value). Shown to the client,
  // not to a second photographer.
  paymentMethod?: string;
  // The day a held date opens again (`yyyy-MM-dd`), while a proposal is out.
  // Shown to the client, not to a second photographer.
  holdUntil?: string;
  // The questionnaire answers (JSON keyed by field id). Selected ONLY by the
  // single-project reads, never in the list projection: the client's own in
  // full (getProjectForEmail), so they can review and resubmit them, and for a
  // second photographer the answers about the shoot (getProjectForViewer, via
  // shootAnswers).
  questionnaireSnapshot?: string;
};

// Column projections. Columns are aliased snake_case → camelCase.
//
// What any portal viewer may read: the client, or a second photographer with
// read access. internal_notes / budget / status_history / inquiry_message /
// referral / source / created_at / updated_at are deliberately NOT selected —
// this is the privacy boundary, enforced at the query.
const VIEWER_SELECT_BASE =
  "id, clientName:client_name, email, phone, partnerName:partner_name, status, serviceType:service_type, eventDate:event_date, secondaryDates:secondary_dates, locations, guestCount:guest_count, planSummary:plan_summary, documents";
// What the client also reads about their own booking. A second photographer
// gets none of it.
const CLIENT_SELECT_EXTRA = ", package, lastClientUpdate:last_client_update";
// Admin-only columns, layered onto the safe projection for the full read.
const FULL_SELECT_EXTRA =
  ", budget, source, questionnaireSnapshot:questionnaire_snapshot, inquiryMessage:inquiry_message, referral, statusHistory:status_history, createdAt:created_at, updatedAt:updated_at";

// Schema-drift guard. A deploy can land before a migration's columns are added
// to the table; the first read that asks for them then fails with PostgREST's
// undefined-column error (SQLSTATE 42703). Rather than surface a 500 on every
// portal + admin page, the reader notes their absence once, drops that group of
// columns for the rest of the process, and retries — so everything keeps working
// (minus those fields) until the migration is applied (a restart re-enables
// them). Each migration's columns are a group of their own, so one missing group
// never takes an established one down with it. Writes aren't covered: a write to
// a missing column fails, so a migration is applied before the code that writes.
type ColumnGroup = { present: boolean; select: string; match: RegExp };
// Bundles and the project name.
const optionalGroup: ColumnGroup = {
  present: true,
  select: ", bundleId:bundle_id, bundleLabel:bundle_label, projectName:project_name",
  match: /(bundle_id|bundle_label|project_name)/,
};
// How the client will pay and the date hold: what the client sees of their
// booking terms.
const termsGroup: ColumnGroup = {
  present: true,
  select: ", paymentMethod:payment_method, holdUntil:hold_until",
  match: /payment_method|hold_until/,
};
// Second-photographer access (collaborators jsonb + collaborator_emails text[]).
const collaboratorGroup: ColumnGroup = {
  present: true,
  select: ", collaborators",
  match: /collaborator/,
};
// The owner's next follow-up on a project, and the Today rows handled or
// snoozed on it.
const followUpGroup: ColumnGroup = {
  present: true,
  select: ", followUpAt:follow_up_at, followUpNote:follow_up_note",
  match: /follow_up/,
};
const todayGroup: ColumnGroup = {
  present: true,
  select: ", todayDismissed:today_dismissed",
  match: /today_dismissed/,
};
// What the AI tools saved: read for one project's page only.
const aiGroup: ColumnGroup = {
  present: true,
  select: ", aiResults:ai_results",
  match: /ai_results/,
};
// Notes from calls with the client: read for one project's page only.
const callsGroup: ColumnGroup = {
  present: true,
  select: ", calls",
  match: /\bcalls\b/,
};
const COLUMN_GROUPS = [
  optionalGroup,
  termsGroup,
  collaboratorGroup,
  followUpGroup,
  todayGroup,
  aiGroup,
  callsGroup,
];
const cols = (group: ColumnGroup) => (group.present ? group.select : "");

type DbResult = { data: unknown; error: { code?: string; message?: string } | null };

// Match a group's own columns specifically so an unrelated schema error is
// never swallowed by the fallback.
function isMissing(group: ColumnGroup, error: DbResult["error"]): boolean {
  return !!error && error.code === "42703" && group.match.test(error.message ?? "");
}

// The client's own projects, as the portal lists them.
function safeSelect(): string {
  return VIEWER_SELECT_BASE + CLIENT_SELECT_EXTRA + cols(optionalGroup) + cols(termsGroup);
}
function fullSelect(): string {
  return (
    safeSelect() +
    FULL_SELECT_EXTRA +
    cols(collaboratorGroup) +
    cols(followUpGroup) +
    cols(todayGroup)
  );
}
// One project's full read, with what the AI tools saved and the call notes.
function detailSelect(): string {
  return fullSelect() + cols(aiGroup) + cols(callsGroup);
}
// The single-project owner read — the safe projection plus the questionnaire
// snapshot, so a signed-in client can review (and resubmit) their own answers.
// Owner-gated by id + email at the call site; never used for the list.
function projectForOwnerSelect(): string {
  return safeSelect() + ", questionnaireSnapshot:questionnaire_snapshot";
}
// A second photographer's read: no package or payment terms. The documents
// column is narrowed afterwards to the kinds they may see
// (collaboratorDocuments), since it is one JSON array.
function collaboratorSelect(): string {
  return VIEWER_SELECT_BASE + cols(optionalGroup);
}
function collaboratorDocuments(
  docs: ClientDocumentEntry[] | undefined,
): ClientDocumentEntry[] {
  return (docs ?? []).filter((d) => documentType(d.type)?.collaborator);
}

// Run a projected read; on a missing-column error from any group, remember it
// and retry once with the reduced projection.
async function readWithOptionalColumns(
  projection: () => string,
  build: (select: string) => PromiseLike<DbResult>,
): Promise<DbResult> {
  const res = await build(projection());
  let retry = false;
  for (const group of COLUMN_GROUPS) {
    if (group.present && isMissing(group, res.error)) {
      group.present = false;
      retry = true;
    }
  }
  return retry ? build(projection()) : res;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
function nowIso(): string {
  return new Date().toISOString();
}

// Project ids are UUIDs. Anything else (a mistyped or truncated URL) can't
// match a row, and handing it to Postgres fails the uuid cast rather than
// finding nothing, so the helpers treat it as a missing row up front: lookups
// answer "not found" and writes do nothing.
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isRecordId(id: string): boolean {
  return RECORD_ID.test(id);
}

// ── Reads ──

export async function getClientById(
  id: string,
): Promise<ClientRecordSafe | null> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return null;
  const { data, error } = await readWithOptionalColumns(safeSelect, (sel) =>
    db().from(TABLE).select(sel).eq("id", id).maybeSingle(),
  );
  if (error) throw error;
  return (data as ClientRecordSafe | null) ?? null;
}

// Existence check for the portal magic link — does this email have ANY
// project? `limit(1)` because there may now be several rows per email.
export async function findClientIdByEmail(
  email: string,
): Promise<string | null> {
  if (!isClientsStoreConfigured()) return null;
  const { data, error } = await db()
    .from(TABLE)
    .select("id")
    .eq("email", normalizeEmail(email))
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.id as string | undefined) ?? null;
}

// All projects for a person — the portal menu lists these.
export async function listProjectsByEmail(
  email: string,
): Promise<ClientRecordSafe[]> {
  if (!isClientsStoreConfigured()) return [];
  const { data, error } = await readWithOptionalColumns(safeSelect, (sel) =>
    db()
      .from(TABLE)
      .select(sel)
      .eq("email", normalizeEmail(email))
      .order("updated_at", { ascending: false }),
  );
  if (error) throw error;
  return (data as ClientRecordSafe[] | null) ?? [];
}

// A single project, but ONLY if it belongs to this email — the ownership gate
// for every portal project page + mutation (prevents IDOR across people). Uses
// the owner projection so the client sees their own questionnaire snapshot.
export async function getProjectForEmail(
  id: string,
  email: string,
): Promise<ClientRecordSafe | null> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return null;
  const { data, error } = await readWithOptionalColumns(
    projectForOwnerSelect,
    (sel) =>
      db()
        .from(TABLE)
        .select(sel)
        .eq("id", id)
        .eq("email", normalizeEmail(email))
        .maybeSingle(),
  );
  if (error) throw error;
  return (data as ClientRecordSafe | null) ?? null;
}

// ── Collaborator (second-photographer) read access ──
//
// A collaborator is a non-owner email granted per-project READ access via the
// `collaborator_emails` array. These power the portal's broadened READ paths;
// every WRITE path keeps using `getProjectForEmail` (owner-only), so collaborator
// access can never reach a mutation.

export type PortalViewerRole = "owner" | "collaborator";

// Does this email own OR collaborate on any project? The magic-link gate
// (request-link + verify). Degrades to owner-only if the collaborator column
// isn't migrated yet.
export async function emailHasPortalAccess(email: string): Promise<boolean> {
  if (!isClientsStoreConfigured()) return false;
  const e = normalizeEmail(email);
  if (await findClientIdByEmail(e)) return true;
  if (!collaboratorGroup.present) return false;
  const { data, error } = await db()
    .from(TABLE)
    .select("id")
    .contains("collaborator_emails", [e])
    .limit(1);
  if (isMissing(collaboratorGroup, error)) {
    collaboratorGroup.present = false;
    return false;
  }
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// All projects a portal viewer can see: their own (owner) plus any shared with
// them (collaborator), each tagged with the viewer's role. Owner wins on overlap.
// Shared projects come through the narrower collaborator projection.
export async function listPortalProjects(
  email: string,
): Promise<Array<ClientRecordSafe & { viewerRole: PortalViewerRole }>> {
  if (!isClientsStoreConfigured()) return [];
  const e = normalizeEmail(email);
  const owned = await listProjectsByEmail(e);
  const byId = new Map<string, ClientRecordSafe & { viewerRole: PortalViewerRole }>();
  for (const p of owned) byId.set(p.id, { ...p, viewerRole: "owner" });

  if (collaboratorGroup.present) {
    const { data, error } = await readWithOptionalColumns(collaboratorSelect, (sel) =>
      db()
        .from(TABLE)
        .select(sel)
        .contains("collaborator_emails", [e])
        .order("updated_at", { ascending: false }),
    );
    if (isMissing(collaboratorGroup, error)) {
      collaboratorGroup.present = false;
    } else if (error) {
      throw error;
    } else {
      for (const p of (data as ClientRecordSafe[] | null) ?? []) {
        if (byId.has(p.id)) continue; // owner role wins
        byId.set(p.id, {
          ...p,
          documents: collaboratorDocuments(p.documents),
          viewerRole: "collaborator",
        });
      }
    }
  }
  return [...byId.values()];
}

// The single-project READ gate for the portal page: returns the record if this
// email is the owner OR a collaborator, with the viewer's role. A collaborator
// gets the narrower projection: no package, payment terms or message thread,
// and only the links and files meant for them, plus the planning answers they
// shoot from (without the booking ones). Distinct from getProjectForEmail so WRITES (which use that) stay
// strictly owner-only.
export async function getProjectForViewer(
  id: string,
  email: string,
): Promise<{ record: ClientRecordSafe; viewerRole: PortalViewerRole } | null> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return null;
  const e = normalizeEmail(email);

  // Owner path first — also covers the pre-migration window with no extra query.
  const owned = await getProjectForEmail(id, e);
  if (owned) return { record: owned, viewerRole: "owner" };
  if (!collaboratorGroup.present) return null;

  // Collaborator path: read the row by id, then authorize against its
  // collaborator list (the projection carries email + collaborator_emails so the
  // check is in-process, never trusting the caller).
  const collabSelect = () =>
    collaboratorSelect() +
    ", questionnaireSnapshot:questionnaire_snapshot, collaborator_emails";
  const { data, error } = await readWithOptionalColumns(collabSelect, (sel) =>
    db().from(TABLE).select(sel).eq("id", id).maybeSingle(),
  );
  if (isMissing(collaboratorGroup, error)) {
    collaboratorGroup.present = false;
    return null;
  }
  if (error) throw error;
  const row = data as
    | (ClientRecordSafe & { collaborator_emails?: string[] })
    | null;
  if (!row) return null;
  const emails = Array.isArray(row.collaborator_emails)
    ? row.collaborator_emails
    : [];
  if (!emails.includes(e)) return null;
  // Strip the internal index column before returning.
  const { collaborator_emails: _drop, ...rest } = row;
  void _drop;
  return {
    record: {
      ...rest,
      documents: collaboratorDocuments(rest.documents),
      // The planning answers they shoot from, without the ones about the
      // booking (the package chosen, add-ons, booked or still deciding).
      questionnaireSnapshot: shootAnswers(rest.serviceType, rest.questionnaireSnapshot),
    },
    viewerRole: "collaborator",
  };
}

// ── Writes ──

// Create or update a project from an inquiry. Matches by email + service, so a
// new service for an existing person becomes a separate project while a repeat
// inquiry for the same service updates the existing one. On a match we only
// fill blank fields + bump the timestamp (never clobber a curated field or an
// advanced status). New projects start at `new-inquiry`. Says which project,
// and whether it now holds this message.
export async function upsertClientFromInquiry(input: {
  name: string;
  email: string;
  phone?: string;
  service?: string;
  eventDate?: string;
  location?: string;
  budget?: string;
  referral?: string;
  message?: string;
  // When set (a manually-created project's completion link), attach to that
  // exact project rather than matching by email+service.
  projectId?: string;
}): Promise<{ id: string; messageStored: boolean } | null> {
  if (!isClientsStoreConfigured()) return null;
  const email = normalizeEmail(input.email);
  const ts = nowIso();

  const FILL =
    "id, email, client_name, phone, service_type, event_date, budget, referral, inquiry_message";
  type FillRow = {
    id: string;
    email?: string;
    client_name?: string;
    phone?: string;
    service_type?: string;
    event_date?: string;
    budget?: string;
    referral?: string;
    inquiry_message?: string;
  };
  let existing: FillRow | undefined;

  // Attach-by-id: only when the project is unclaimed or already this email's, so
  // a leaked completion link can't write into someone else's record.
  if (input.projectId && isRecordId(input.projectId)) {
    const { data: byId } = await db()
      .from(TABLE)
      .select(FILL)
      .eq("id", input.projectId)
      .maybeSingle();
    const row = byId as FillRow | null;
    if (row && (!row.email || normalizeEmail(row.email) === email)) existing = row;
  }

  // Otherwise dedup by email + service, as before.
  if (!existing) {
    let match = db().from(TABLE).select(FILL).eq("email", email);
    match = input.service
      ? match.eq("service_type", input.service)
      : match.is("service_type", null);
    const { data: existingRows, error: selErr } = await match.limit(1);
    if (selErr) throw selErr;
    existing = existingRows?.[0] as FillRow | undefined;
  }

  if (existing?.id) {
    const patch: Record<string, unknown> = { updated_at: ts };
    if (!existing.email) patch.email = email;
    if (!existing.client_name && input.name) patch.client_name = input.name;
    if (!existing.phone && input.phone) patch.phone = input.phone;
    if (!existing.service_type && input.service) patch.service_type = input.service;
    if (!existing.event_date && input.eventDate) patch.event_date = input.eventDate;
    if (!existing.budget && input.budget) patch.budget = input.budget;
    if (!existing.referral && input.referral) patch.referral = input.referral;
    if (!existing.inquiry_message && input.message)
      patch.inquiry_message = input.message;
    // Whether the project now holds this message (a repeat inquiry keeps the
    // first one), so what's said about it is saved only when it matches.
    const messageStored =
      !!input.message &&
      (!existing.inquiry_message ||
        existing.inquiry_message.trim() === input.message.trim());
    const { error } = await db().from(TABLE).update(patch).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id as string, messageStored };
  }

  const locations = input.location
    ? [{ label: "Venue / location", address: input.location }]
    : [];
  const { data, error } = await db()
    .from(TABLE)
    .insert({
      client_name: input.name,
      email,
      phone: input.phone || null,
      status: "new-inquiry",
      service_type: input.service || null,
      source: "inquiry-form",
      event_date: input.eventDate || null,
      locations,
      budget: input.budget || null,
      inquiry_message: input.message || null,
      referral: input.referral || null,
      status_history: [
        { status: "new-inquiry", changedAt: ts, note: "Inquiry received" },
      ],
      created_at: ts,
      updated_at: ts,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, messageStored: !!input.message };
}

// Manually create a project stub (admin or client portal). No dedup here — the
// caller decides "warn but allow"; the project starts at new-inquiry.
export async function createProjectManual(input: {
  email: string;
  clientName?: string;
  phone?: string;
  serviceType?: string;
  eventDate?: string;
  package?: string;
  source: "manual-admin" | "manual-client";
}): Promise<string | null> {
  if (!isClientsStoreConfigured()) return null;
  const ts = nowIso();
  const note =
    input.source === "manual-admin" ? "Created by admin" : "Created by client";
  const { data, error } = await db()
    .from(TABLE)
    .insert({
      client_name: input.clientName || null,
      email: normalizeEmail(input.email),
      phone: input.phone || null,
      status: "new-inquiry",
      service_type: input.serviceType || null,
      package: input.package || null,
      event_date: input.eventDate || null,
      source: input.source,
      status_history: [{ status: "new-inquiry", changedAt: ts, note }],
      created_at: ts,
      updated_at: ts,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// An existing project for this email + service — drives the "you already have a
// … project" warning on manual creation (the user can still create a second).
export async function findDuplicateProject(
  email: string,
  serviceType?: string,
): Promise<{ id: string; clientName?: string; serviceType?: string } | null> {
  if (!isClientsStoreConfigured()) return null;
  let q = db()
    .from(TABLE)
    .select("id, client_name, service_type")
    .eq("email", normalizeEmail(email));
  q = serviceType
    ? q.eq("service_type", serviceType)
    : q.is("service_type", null);
  const { data, error } = await q.limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id as string,
    clientName: (row.client_name as string) || undefined,
    serviceType: (row.service_type as string) || undefined,
  };
}

// Attach a questionnaire submission to the matching record (creating one if
// none exists), snapshot the answers and link the generated PDF. A booked
// project moves on to "planning"; a prospect (not booked yet, or a new record)
// keeps its place, since filling in the questionnaire isn't booking.
export async function attachQuestionnaire(input: {
  name?: string;
  email: string;
  service?: string;
  answersJson: string;
  pdf?: { label: string; url: string };
  // When set (a created project's completion link), attach to that exact
  // project rather than matching by email+service.
  projectId?: string;
}): Promise<string | null> {
  if (!isClientsStoreConfigured()) return null;
  const email = normalizeEmail(input.email);
  const ts = nowIso();

  type QRow = {
    id: string;
    email?: string;
    service_type?: string;
    client_name?: string;
    status?: string;
  };
  const SEL = "id, email, service_type, client_name, status";
  let existing: QRow | undefined;

  // Attach-by-id when the project is unclaimed or already this email's.
  if (input.projectId && isRecordId(input.projectId)) {
    const { data: byId } = await db()
      .from(TABLE)
      .select(SEL)
      .eq("id", input.projectId)
      .maybeSingle();
    const row = byId as QRow | null;
    if (row && (!row.email || normalizeEmail(row.email) === email)) existing = row;
  }

  // Otherwise match the project for this service (so an engagement questionnaire
  // attaches to the engagement project, not a wedding one).
  if (!existing) {
    let match = db().from(TABLE).select(SEL).eq("email", email);
    match = input.service
      ? match.eq("service_type", input.service)
      : match.is("service_type", null);
    const { data: existingRows, error: selErr } = await match.limit(1);
    if (selErr) throw selErr;
    existing = existingRows?.[0] as QRow | undefined;
  }

  // Sync the structured answers the client gave back onto the record so the
  // portal + admin reflect them without re-entry — one canonical value per
  // field (the bare package name, etc.). Parsed defensively; a non-JSON
  // snapshot just skips the sync.
  const synced: Record<string, unknown> = {};
  try {
    const a = JSON.parse(input.answersJson) as Record<string, unknown>;
    const str = (k: string) =>
      typeof a[k] === "string" ? (a[k] as string).trim() : "";
    const pkg = str("package");
    if (pkg && pkg !== "Still deciding") synced.package = pkg;
    const ed = str("eventDate");
    if (ed) synced.event_date = ed;
    const pn = str("partnerFullName");
    if (pn) synced.partner_name = pn;
    const gc = str("guestCount");
    if (gc && !Number.isNaN(Number(gc))) synced.guest_count = Number(gc);
  } catch {
    /* snapshot isn't a JSON object — skip the structured sync */
  }

  let id = (existing?.id as string | undefined) ?? null;
  if (!id) {
    const { data, error } = await db()
      .from(TABLE)
      .insert({
        client_name: input.name || null,
        email,
        status: "new-inquiry",
        service_type: input.service || null,
        source: "questionnaire",
        questionnaire_snapshot: input.answersJson,
        ...synced,
        status_history: [
          { status: "new-inquiry", changedAt: ts, note: "Questionnaire submitted" },
        ],
        created_at: ts,
        updated_at: ts,
      })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id as string;
  } else {
    const patch: Record<string, unknown> = {
      questionnaire_snapshot: input.answersJson,
      ...synced,
      updated_at: ts,
    };
    if (!existing?.service_type && input.service) patch.service_type = input.service;
    if (!existing?.email) patch.email = email;
    if (!existing?.client_name && input.name) patch.client_name = input.name;
    const { error } = await db().from(TABLE).update(patch).eq("id", id);
    if (error) throw error;
    if (statusRank(existing?.status) >= statusRank("booked")) {
      await advanceStatus(id, "planning", "Questionnaire submitted");
    }
  }

  if (id && input.pdf) {
    await addDocument(id, {
      label: input.pdf.label,
      type: "questionnaire-pdf",
      url: input.pdf.url,
      uploadedBy: "julian",
    });
  }
  return id;
}

// Move a record forward in the pipeline. No-op if the target is the same or
// earlier than the current status, or if the project is closed (archived, lost
// or declined): those are only ever reopened by hand. Says whether it moved.
export async function advanceStatus(
  id: string,
  target: ClientStatus,
  note?: string,
): Promise<boolean> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return false;
  const { data: row, error: selErr } = await db()
    .from(TABLE)
    .select("status, status_history")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return false;
  if (CLIENT_STATUS_TERMINAL.includes(row.status as ClientStatus)) return false;
  if (statusRank(target) <= statusRank(row.status as string)) return false;
  const ts = nowIso();
  const history = Array.isArray(row.status_history) ? row.status_history : [];
  history.push({ status: target, changedAt: ts, note });
  const { error } = await db()
    .from(TABLE)
    .update({ status: target, status_history: history, updated_at: ts })
    .eq("id", id);
  if (error) throw error;
  return true;
}

// A closed project (archived, lost or declined) has nothing left to follow up
// or hold, so whatever closes one clears both.
const CLOSED_CLEARS = { follow_up_at: null, follow_up_note: null, hold_until: null };
const closes = (from: unknown, to: unknown) =>
  from !== to && CLIENT_STATUS_TERMINAL.includes(to as ClientStatus);

// Close a project (archived, lost or declined), from any stage: the owner sent
// the email that says so. No-op when it already has that status. Says whether
// it changed.
export async function closeProject(
  id: string,
  status: ClientStatus,
  note: string,
): Promise<boolean> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return false;
  if (!CLIENT_STATUS_TERMINAL.includes(status)) return false;
  const { data: row, error: selErr } = await db()
    .from(TABLE)
    .select("status, status_history")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row || row.status === status) return false;
  const ts = nowIso();
  const history = Array.isArray(row.status_history) ? row.status_history : [];
  history.push({ status, changedAt: ts, note });
  const { error } = await db()
    .from(TABLE)
    .update({ status, status_history: history, ...CLOSED_CLEARS, updated_at: ts })
    .eq("id", id);
  if (error) throw error;
  return true;
}

// Set (or with null, clear) the project's next follow-up: a calendar day and
// what it's for. One per project; a new one replaces the old. Without a note,
// a moved follow-up keeps the one it had; an empty note clears it. With
// `expect` (the day of the follow-up the change was made against, or null for
// none), it changes only while the project still has that one, and says false
// when it has a different one now.
export async function setFollowUp(
  id: string,
  at: string | null,
  note?: string | null,
  expect?: string | null,
): Promise<boolean> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return true;
  const patch: Record<string, unknown> = { follow_up_at: at, updated_at: nowIso() };
  if (at === null) patch.follow_up_note = null;
  else if (note !== undefined) patch.follow_up_note = note?.trim() || null;
  let q = db().from(TABLE).update(patch, { count: "exact" }).eq("id", id);
  if (expect === null) q = q.is("follow_up_at", null);
  else if (expect) q = q.eq("follow_up_at", expect);
  const { error, count } = await q;
  if (error) throw error;
  return expect === undefined || (count ?? 0) > 0;
}

// Hold the project's date until a calendar day (or with null, release it).
export async function setHold(id: string, until: string | null): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const { error } = await db()
    .from(TABLE)
    .update({ hold_until: until, updated_at: nowIso() })
    .eq("id", id);
  if (error) throw error;
}

// ── Links and files ──
//
// The documents array changes through Postgres functions (supabase/schema.sql),
// one statement each, so a client upload and an owner edit landing together
// can't overwrite each other.

// Add a link or file to a project. The entry gets its id and timestamp here. A
// kind that marks a milestone (highlights, the gallery) also moves the project
// forward to that stage; nothing is sent to the client.
export async function addDocument(
  id: string,
  doc: Omit<ClientDocumentEntry, "id" | "uploadedAt">,
): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const entry: ClientDocumentEntry = {
    ...doc,
    id: randomUUID(),
    uploadedAt: nowIso(),
  };
  const { error } = await db().rpc("add_document", { p_id: id, p_doc: entry });
  if (error) throw error;
  const info = documentType(doc.type);
  if (info?.advancesTo) {
    await advanceStatus(id, info.advancesTo, `${info.label} added`);
  }
}

// Take one entry off the project. An uploaded file itself stays in storage.
export async function removeDocument(id: string, docId: string): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const { error } = await db().rpc("remove_document", {
    p_id: id,
    p_doc_id: docId,
  });
  if (error) throw error;
}

// Change one entry: its label, or an invoice's due and paid dates. A null
// clears that value.
export type ClientDocumentPatch = {
  label?: string;
  dueAt?: string | null;
  paidAt?: string | null;
};
export async function patchDocument(
  id: string,
  docId: string,
  patch: ClientDocumentPatch,
): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const { error } = await db().rpc("patch_document", {
    p_id: id,
    p_doc_id: docId,
    p_patch: patch,
  });
  if (error) throw error;
}

// Grant a second photographer read access to one project. Keeps the rich
// `collaborators` array and the queryable `collaborator_emails` index in
// lockstep; idempotent on the normalized email.
export async function addCollaborator(
  id: string,
  input: { email: string; name?: string },
): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const email = normalizeEmail(input.email);
  const { data: row, error: selErr } = await db()
    .from(TABLE)
    .select("collaborators, collaborator_emails")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return;
  const collaborators: CollaboratorEntry[] = Array.isArray(row.collaborators)
    ? row.collaborators
    : [];
  if (collaborators.some((c) => normalizeEmail(c.email ?? "") === email)) return;
  collaborators.push({ email, name: input.name, addedAt: nowIso() });
  const emails = Array.from(
    new Set([
      ...(Array.isArray(row.collaborator_emails) ? row.collaborator_emails : []),
      email,
    ]),
  );
  const { error } = await db()
    .from(TABLE)
    .update({
      collaborators,
      collaborator_emails: emails,
      updated_at: nowIso(),
    })
    .eq("id", id);
  if (error) throw error;
}

// Revoke a collaborator's access — filters both columns by normalized email.
// Effective immediately (access is re-checked per request).
export async function removeCollaborator(
  id: string,
  email: string,
): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const e = normalizeEmail(email);
  const { data: row, error: selErr } = await db()
    .from(TABLE)
    .select("collaborators, collaborator_emails")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return;
  const collaborators = (
    Array.isArray(row.collaborators) ? row.collaborators : []
  ).filter((c: CollaboratorEntry) => normalizeEmail(c.email ?? "") !== e);
  const emails = (
    Array.isArray(row.collaborator_emails) ? row.collaborator_emails : []
  ).filter((x: string) => normalizeEmail(x) !== e);
  const { error } = await db()
    .from(TABLE)
    .update({
      collaborators,
      collaborator_emails: emails,
      updated_at: nowIso(),
    })
    .eq("id", id);
  if (error) throw error;
}

// The only fields a signed-in client may edit on their own project. Status,
// package, pricing, the admin-authored plan and internal fields never are;
// questions and notes go in the message thread.
const CLIENT_EDITABLE = ["phone", "partnerName", "guestCount", "projectName"] as const;
const EDITABLE_COLUMN: Record<(typeof CLIENT_EDITABLE)[number], string> = {
  phone: "phone",
  partnerName: "partner_name",
  guestCount: "guest_count",
  projectName: "project_name",
};
export type ClientEditableFields = Partial<{
  phone: string;
  partnerName: string;
  guestCount: number;
  projectName: string;
}>;

export async function updateClientFields(
  id: string,
  fields: ClientEditableFields,
): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const patch: Record<string, unknown> = {};
  for (const k of CLIENT_EDITABLE) {
    const v = fields[k];
    if (v !== undefined) patch[EDITABLE_COLUMN[k]] = v;
  }
  const ts = nowIso();
  patch.updated_at = ts;
  patch.last_client_update = ts;
  const { error } = await db().from(TABLE).update(patch).eq("id", id);
  if (error) throw error;
}

// ── Admin (owner-only) reads + writes ──
//
// These return / accept the FULL row, including internal fields. They are only
// ever called from `/admin/*` pages + routes, which are gated by the admin
// session.

// One entry in a project's activity log (the status_history column): a move
// in the pipeline, with what moved it, or a note the owner added (`kind:
// "note"`, with the status the project had then). The notes once kept in the
// private notes box are the log's first entry, undated, `from:
// "internal-notes"`.
export type ClientStatusEntry = {
  status?: string;
  changedAt?: string;
  note?: string;
  kind?: "note";
  from?: "internal-notes";
};
export type ClientRecordFull = ClientRecordSafe & {
  budget?: string;
  // The owner's next follow-up: a calendar day and what it's for.
  followUpAt?: string;
  followUpNote?: string;
  // Today rows marked handled ("handled") or snoozed (until a calendar day),
  // by row key (src/lib/today.ts).
  todayDismissed?: Record<string, string>;
  // When each side last wrote (listClients only, from client_last_contact).
  lastInAt?: string;
  lastOutAt?: string;
  // What the AI tools saved (getClientFull only).
  aiResults?: AiResults;
  // Notes from calls with the client (getClientFull only).
  calls?: ProjectCalls;
  source?: string;
  questionnaireSnapshot?: string;
  inquiryMessage?: string;
  referral?: string;
  statusHistory?: ClientStatusEntry[];
  collaborators?: CollaboratorEntry[];
  createdAt?: string;
  updatedAt?: string;
};

export async function listClients(): Promise<ClientRecordFull[]> {
  if (!isClientsStoreConfigured()) return [];
  const [{ data, error }, contact] = await Promise.all([
    readWithOptionalColumns(fullSelect, (sel) =>
      db().from(TABLE).select(sel).order("updated_at", { ascending: false }),
    ),
    lastContactByProject(),
  ]);
  if (error) throw error;
  return ((data as ClientRecordFull[] | null) ?? []).map((r) => ({
    ...r,
    ...contact.get(r.id),
  }));
}

// When each side last wrote, by project (the client_last_contact view). The
// board reads it in one extra query; before the view exists it's empty.
async function lastContactByProject(): Promise<
  Map<string, { lastInAt?: string; lastOutAt?: string }>
> {
  const { data, error } = await db()
    .from("client_last_contact")
    .select("project_id, last_in_at, last_out_at");
  if (error) {
    if (error.code === "42P01" || /client_last_contact/.test(error.message ?? "")) {
      return new Map();
    }
    throw error;
  }
  type Row = { project_id: string; last_in_at: string | null; last_out_at: string | null };
  return new Map(
    ((data as Row[] | null) ?? []).map((r) => [
      r.project_id,
      { lastInAt: r.last_in_at ?? undefined, lastOutAt: r.last_out_at ?? undefined },
    ]),
  );
}

export async function getClientFull(
  id: string,
): Promise<ClientRecordFull | null> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return null;
  const { data, error } = await readWithOptionalColumns(detailSelect, (sel) =>
    db().from(TABLE).select(sel).eq("id", id).maybeSingle(),
  );
  if (error) throw error;
  return (data as ClientRecordFull | null) ?? null;
}

const ADMIN_COLUMN: Record<string, string> = {
  clientName: "client_name",
  email: "email",
  phone: "phone",
  partnerName: "partner_name",
  status: "status",
  serviceType: "service_type",
  package: "package",
  eventDate: "event_date",
  guestCount: "guest_count",
  budget: "budget",
  planSummary: "plan_summary",
  projectName: "project_name",
  locations: "locations",
  paymentMethod: "payment_method",
};

export async function updateClientAdmin(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const patch: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(ADMIN_COLUMN)) {
    if (k in fields && fields[k] !== undefined) patch[col] = fields[k];
  }
  if (typeof patch.email === "string") patch.email = normalizeEmail(patch.email);
  // "Not chosen" is stored as no value, not an empty string.
  if (patch.payment_method === "") patch.payment_method = null;
  const ts = nowIso();
  patch.updated_at = ts;

  // Append a status-history entry when the status actually changes.
  if ("status" in patch) {
    const { data: row } = await db()
      .from(TABLE)
      .select("status, status_history")
      .eq("id", id)
      .maybeSingle();
    if (row && row.status !== patch.status) {
      const history = Array.isArray(row.status_history)
        ? row.status_history
        : [];
      history.push({ status: patch.status, changedAt: ts, note: "Updated by admin" });
      patch.status_history = history;
      if (closes(row.status, patch.status)) Object.assign(patch, CLOSED_CLEARS);
    }
  }

  const { error } = await db().from(TABLE).update(patch).eq("id", id);
  if (error) throw error;
}

// Add a dated note to the project's activity log, under the status it has
// now. One statement (add_activity in supabase/schema.sql), so a note landing
// while a send moves the project isn't lost. Says whether the project exists.
export async function addNote(id: string, note: string): Promise<boolean> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return false;
  const { data: row, error: selErr } = await db()
    .from(TABLE)
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return false;
  const { data, error } = await db().rpc("add_activity", {
    p_id: id,
    p_entry: { kind: "note", status: row.status, note, changedAt: nowIso() },
  });
  if (error) throw error;
  return data === true;
}

// List the full set of a person's projects (admin) — used to offer "link into
// a bundle" choices on the project edit page.
export async function listClientProjectsByEmailFull(
  email: string,
): Promise<ClientRecordFull[]> {
  if (!isClientsStoreConfigured()) return [];
  const { data, error } = await readWithOptionalColumns(fullSelect, (sel) =>
    db()
      .from(TABLE)
      .select(sel)
      .eq("email", normalizeEmail(email))
      .order("updated_at", { ascending: false }),
  );
  if (error) throw error;
  return (data as ClientRecordFull[] | null) ?? [];
}

// ── Bundles ──
//
// Projects sharing a `bundle_id` are bundled; `bundle_label` is the display
// name (denormalized onto each row). Linking assigns a fresh shared id + label
// to the selected projects; unlinking clears them on one project. Both the
// client and admin paths enforce that every project in a bundle belongs to the
// same person (same email), so a bundle can never span two clients.

async function applyBundle(
  ids: string[],
  bundleId: string | null,
  label: string | null,
): Promise<void> {
  const { error } = await db()
    .from(TABLE)
    .update({ bundle_id: bundleId, bundle_label: label, updated_at: nowIso() })
    .in("id", ids);
  if (error) throw error;
}

// Client: link 2+ of the signed-in person's own projects. Any id not owned by
// `email` is silently dropped, so a client can't pull in someone else's row.
export async function setBundleForEmail(
  email: string,
  projectIds: string[],
  label: string,
): Promise<void> {
  const asked = projectIds.filter(isRecordId);
  if (!isClientsStoreConfigured() || asked.length < 2) return;
  const { data: owned, error } = await db()
    .from(TABLE)
    .select("id")
    .eq("email", normalizeEmail(email))
    .in("id", asked);
  if (error) throw error;
  const ids = (owned ?? []).map((r) => r.id as string);
  if (ids.length < 2) return;
  await applyBundle(ids, randomUUID(), label.trim() || "Bundle");
}

export async function clearBundleForEmail(
  email: string,
  projectId: string,
): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(projectId)) return;
  const { data: owned, error } = await db()
    .from(TABLE)
    .select("id")
    .eq("email", normalizeEmail(email))
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!owned) return;
  await applyBundle([projectId], null, null);
}

// Admin: link projects into a bundle. Enforces they all belong to one person.
export async function setBundleAdmin(
  projectIds: string[],
  label: string,
): Promise<void> {
  const ids = projectIds.filter(isRecordId);
  if (!isClientsStoreConfigured() || ids.length < 2) return;
  const { data: rows, error } = await db()
    .from(TABLE)
    .select("id, email")
    .in("id", ids);
  if (error) throw error;
  const emails = new Set((rows ?? []).map((r) => r.email as string));
  if (emails.size !== 1 || (rows ?? []).length < 2) return;
  await applyBundle(
    (rows ?? []).map((r) => r.id as string),
    randomUUID(),
    label.trim() || "Bundle",
  );
}

export async function clearBundleAdmin(projectId: string): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(projectId)) return;
  await applyBundle([projectId], null, null);
}

// Permanently delete one project row (admin-only). No-ops cleanly when the
// store isn't configured. Bundle siblings are unaffected — only this row goes.
export async function deleteClient(id: string): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const { error } = await db().from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

// Save what an AI tool worked out for a project, one kind at a time (see
// save_ai_result in supabase/schema.sql).
export async function saveAiResult<K extends SavedAiKind>(
  id: string,
  kind: K,
  saved: NonNullable<AiResults[K]> extends SavedAiResult<infer T> ? SavedAiResult<T> : never,
): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const { error } = await db().rpc("save_ai_result", {
    p_id: id,
    p_kind: kind,
    p_result: saved,
  });
  if (error) throw error;
}

// What saving to a call found: the call had been saved since the copy the
// patch was typed against (nothing changed), or it was saved, with whether the
// call was already marked held and the project's status.
export type CallSave =
  | { conflict: true }
  | { conflict: false; savedAt?: string; held: boolean; status?: string };

// Merge a patch into one call (see merge_call in supabase/schema.sql): answers
// and the questions they were typed under key by key, the held time kept once
// set, anything else replaced. Answers and notes are stamped with the time
// they were saved, the copy that saved them (`writer`) and that copy's count
// of saves (`seq`), and with `base` (the stamp they were typed against, "" for
// never saved) land only when nothing was saved since by another copy, or by
// a later save of this one. Null without a store or for no such project.
export async function saveCall(
  id: string,
  call: CallKind,
  patch: CallNotes,
  base?: string,
  writer?: string,
  seq?: number,
): Promise<CallSave | null> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return null;
  const notes = patch.answers !== undefined || patch.notes !== undefined;
  const savedAt = notes ? nowIso() : undefined;
  const stamp = { savedAt, ...(writer ? { savedBy: writer, savedSeq: seq } : {}) };
  const { data, error } = await db().rpc("merge_call", {
    p_id: id,
    p_call: call,
    p_patch: savedAt ? { ...patch, ...stamp } : patch,
    p_base: base ?? null,
    p_writer: writer ?? null,
    p_seq: seq ?? null,
  });
  if (error) throw error;
  const found = data as { conflict: boolean; held?: boolean; status?: string } | null;
  if (!found) return null;
  if (found.conflict) return { conflict: true };
  return { conflict: false, savedAt, held: !!found.held, status: found.status };
}

// Mark one Today row handled, or snooze it until a calendar day (see
// dismiss_today in supabase/schema.sql).
export async function dismissToday(id: string, key: string, value: "handled" | string): Promise<void> {
  if (!isClientsStoreConfigured() || !isRecordId(id)) return;
  const { error } = await db().rpc("dismiss_today", { p_id: id, p_key: key, p_value: value });
  if (error) throw error;
}
