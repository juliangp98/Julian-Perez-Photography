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
// reads — it omits `internal_notes`, `questionnaire_snapshot`, `status_history`,
// inquiry context, and meta timestamps, so those never reach a client. Portal
// reads are additionally scoped to the signed-in person's email (ownership), and
// the admin dashboard sees the full row (`fullSelect()`).

import "server-only";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { statusRank, type ClientStatus } from "@/lib/client-status";

const TABLE = "client_records";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;
function db(): SupabaseClient {
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

export type ClientDocumentEntry = {
  label: string;
  type?: string;
  url: string;
  uploadedBy?: "julian" | "client";
  uploadedAt?: string;
};
export type ClientLocationEntry = {
  label?: string;
  address?: string;
  notes?: string;
};
export type ClientDateEntry = { label?: string; date?: string };

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
  budget?: string;
  planSummary?: string;
  // Client-authored notes / questions, and Julian's reply to them. Distinct
  // from `planSummary` (the admin-authored shoot plan).
  clientNotes?: string;
  clientNotesReply?: string;
  documents?: ClientDocumentEntry[];
  lastClientUpdate?: string;
  bundleId?: string;
  bundleLabel?: string;
  galleryUrl?: string;
  projectName?: string;
};

// Column projection for the portal. Columns are aliased snake_case → camelCase.
// internal_notes / questionnaire_snapshot / status_history / inquiry_message /
// referral / source / created_at / updated_at are deliberately NOT selected —
// this is the privacy boundary, enforced at the query.
const SAFE_SELECT_BASE =
  "id, clientName:client_name, email, phone, partnerName:partner_name, status, serviceType:service_type, package, eventDate:event_date, secondaryDates:secondary_dates, locations, guestCount:guest_count, budget, planSummary:plan_summary, documents, lastClientUpdate:last_client_update";
// Columns added by post-launch migrations (bundles, gallery URL) — appended
// only while the live table is known to have them.
const OPTIONAL_COLUMNS =
  ", bundleId:bundle_id, bundleLabel:bundle_label, galleryUrl:gallery_url, projectName:project_name, clientNotes:client_notes, clientNotesReply:client_notes_reply";
// Admin-only columns, layered onto the safe projection for the full read.
const FULL_SELECT_EXTRA =
  ", source, questionnaireSnapshot:questionnaire_snapshot, inquiryMessage:inquiry_message, referral, statusHistory:status_history, internalNotes:internal_notes, createdAt:created_at, updatedAt:updated_at";

// Schema-drift guard. A deploy can land before a migration's columns are added
// to the table; the first read that asks for them then fails with PostgREST's
// undefined-column error (SQLSTATE 42703). Rather than surface a 500 on every
// portal + admin page, the reader notes their absence once, drops the optional
// columns for the rest of the process, and retries — so everything keeps working
// (minus those fields) until the migration is applied (a restart re-enables them).
let optionalColumnsPresent = true;

function safeSelect(): string {
  return optionalColumnsPresent
    ? SAFE_SELECT_BASE + OPTIONAL_COLUMNS
    : SAFE_SELECT_BASE;
}
function fullSelect(): string {
  return safeSelect() + FULL_SELECT_EXTRA;
}

type DbResult = { data: unknown; error: { code?: string; message?: string } | null };

// Match the known optional columns specifically so an unrelated schema error is
// never swallowed by the fallback.
function isMissingOptionalColumn(error: DbResult["error"]): boolean {
  return (
    !!error &&
    error.code === "42703" &&
    /(bundle_id|bundle_label|gallery_url|project_name|client_notes_reply|client_notes)/.test(
      error.message ?? "",
    )
  );
}

// Run a projected read; on a missing optional-column error, remember it and
// retry once with the reduced projection.
async function readWithOptionalColumns(
  projection: () => string,
  build: (select: string) => PromiseLike<DbResult>,
): Promise<DbResult> {
  const res = await build(projection());
  if (isMissingOptionalColumn(res.error) && optionalColumnsPresent) {
    optionalColumnsPresent = false;
    return build(projection());
  }
  return res;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
function nowIso(): string {
  return new Date().toISOString();
}

// ── Reads ──

export async function getClientById(
  id: string,
): Promise<ClientRecordSafe | null> {
  if (!isClientsStoreConfigured()) return null;
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
// for every portal project page + mutation (prevents IDOR across people).
export async function getProjectForEmail(
  id: string,
  email: string,
): Promise<ClientRecordSafe | null> {
  if (!isClientsStoreConfigured()) return null;
  const { data, error } = await readWithOptionalColumns(safeSelect, (sel) =>
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

// ── Writes ──

// Create or update a project from an inquiry. Matches by email + service, so a
// new service for an existing person becomes a separate project while a repeat
// inquiry for the same service updates the existing one. On a match we only
// fill blank fields + bump the timestamp (never clobber a curated field or an
// advanced status). New projects start at `new-inquiry`.
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
}): Promise<string | null> {
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
  if (input.projectId) {
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
    const { error } = await db().from(TABLE).update(patch).eq("id", existing.id);
    if (error) throw error;
    return existing.id as string;
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
  return data.id as string;
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
// none exists), snapshot the answers, link the generated PDF, and advance the
// status toward "planning" without regressing a further-along record.
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

  type QRow = { id: string; email?: string; service_type?: string; client_name?: string };
  const SEL = "id, email, service_type, client_name";
  let existing: QRow | undefined;

  // Attach-by-id when the project is unclaimed or already this email's.
  if (input.projectId) {
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
        status: "planning",
        service_type: input.service || null,
        source: "questionnaire",
        questionnaire_snapshot: input.answersJson,
        ...synced,
        status_history: [
          { status: "planning", changedAt: ts, note: "Questionnaire submitted" },
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
    await advanceStatus(id, "planning", "Questionnaire submitted");
  }

  if (id && input.pdf) {
    await appendDocument(id, {
      label: input.pdf.label,
      type: "questionnaire-pdf",
      url: input.pdf.url,
      uploadedBy: "julian",
      uploadedAt: ts,
    });
  }
  return id;
}

// Move a record forward in the pipeline. No-op if the target is the same or
// earlier than the current status.
export async function advanceStatus(
  id: string,
  target: ClientStatus,
  note?: string,
): Promise<void> {
  if (!isClientsStoreConfigured()) return;
  const { data: row, error: selErr } = await db()
    .from(TABLE)
    .select("status, status_history")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return;
  if (statusRank(target) <= statusRank(row.status as string)) return;
  const ts = nowIso();
  const history = Array.isArray(row.status_history) ? row.status_history : [];
  history.push({ status: target, changedAt: ts, note });
  const { error } = await db()
    .from(TABLE)
    .update({ status: target, status_history: history, updated_at: ts })
    .eq("id", id);
  if (error) throw error;
}

export async function appendDocument(
  id: string,
  doc: ClientDocumentEntry,
): Promise<void> {
  if (!isClientsStoreConfigured()) return;
  const { data: row, error: selErr } = await db()
    .from(TABLE)
    .select("documents")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return;
  const docs = Array.isArray(row.documents) ? row.documents : [];
  docs.push(doc);
  const { error } = await db()
    .from(TABLE)
    .update({ documents: docs, updated_at: nowIso() })
    .eq("id", id);
  if (error) throw error;
}

// Whitelisted client-portal edits. Only these fields are ever writable from the
// portal; status, package, pricing, and internal fields are never exposed.
// Fields a signed-in client may edit on their own project. `planSummary` is
// deliberately NOT here — the shoot plan is admin-authored; clients write
// `clientNotes` (their notes / questions) instead.
const CLIENT_EDITABLE = [
  "phone",
  "partnerName",
  "guestCount",
  "clientNotes",
  "projectName",
] as const;
const EDITABLE_COLUMN: Record<(typeof CLIENT_EDITABLE)[number], string> = {
  phone: "phone",
  partnerName: "partner_name",
  guestCount: "guest_count",
  clientNotes: "client_notes",
  projectName: "project_name",
};
export type ClientEditableFields = Partial<{
  phone: string;
  partnerName: string;
  guestCount: number;
  clientNotes: string;
  projectName: string;
}>;

export async function updateClientFields(
  id: string,
  fields: ClientEditableFields,
): Promise<void> {
  if (!isClientsStoreConfigured()) return;
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

export type ClientStatusEntry = {
  status?: string;
  changedAt?: string;
  note?: string;
};
export type ClientRecordFull = ClientRecordSafe & {
  source?: string;
  questionnaireSnapshot?: string;
  inquiryMessage?: string;
  referral?: string;
  statusHistory?: ClientStatusEntry[];
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function listClients(): Promise<ClientRecordFull[]> {
  if (!isClientsStoreConfigured()) return [];
  const { data, error } = await readWithOptionalColumns(fullSelect, (sel) =>
    db().from(TABLE).select(sel).order("updated_at", { ascending: false }),
  );
  if (error) throw error;
  return (data as ClientRecordFull[] | null) ?? [];
}

export async function getClientFull(
  id: string,
): Promise<ClientRecordFull | null> {
  if (!isClientsStoreConfigured()) return null;
  const { data, error } = await readWithOptionalColumns(fullSelect, (sel) =>
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
  clientNotesReply: "client_notes_reply",
  internalNotes: "internal_notes",
  galleryUrl: "gallery_url",
  projectName: "project_name",
};

export async function updateClientAdmin(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  if (!isClientsStoreConfigured()) return;
  const patch: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(ADMIN_COLUMN)) {
    if (k in fields && fields[k] !== undefined) patch[col] = fields[k];
  }
  if (typeof patch.email === "string") patch.email = normalizeEmail(patch.email);
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
    }
  }

  const { error } = await db().from(TABLE).update(patch).eq("id", id);
  if (error) throw error;
}

// Quick admin log entry from the projects overview: append a status-history note
// and optionally change the status, without opening the full record. At least
// one of `status` / `note` is expected (the route enforces this).
export async function addAdminLog(
  id: string,
  input: { status?: string; note?: string },
): Promise<void> {
  if (!isClientsStoreConfigured()) return;
  const { data: row, error } = await db()
    .from(TABLE)
    .select("status, status_history")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return;

  const ts = nowIso();
  const statusChanged = !!input.status && input.status !== row.status;
  const nextStatus = (input.status as string | undefined) ?? (row.status as string | undefined);
  const note =
    input.note?.trim() ||
    (statusChanged ? "Status updated by admin" : "Note added by admin");

  const history = Array.isArray(row.status_history) ? row.status_history : [];
  history.push({ status: nextStatus, changedAt: ts, note });

  const patch: Record<string, unknown> = {
    status_history: history,
    updated_at: ts,
  };
  if (statusChanged) patch.status = input.status;

  const { error: upErr } = await db().from(TABLE).update(patch).eq("id", id);
  if (upErr) throw upErr;
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
  if (!isClientsStoreConfigured()) return;
  const { data: owned, error } = await db()
    .from(TABLE)
    .select("id")
    .eq("email", normalizeEmail(email))
    .in("id", projectIds);
  if (error) throw error;
  const ids = (owned ?? []).map((r) => r.id as string);
  if (ids.length < 2) return;
  await applyBundle(ids, randomUUID(), label.trim() || "Bundle");
}

export async function clearBundleForEmail(
  email: string,
  projectId: string,
): Promise<void> {
  if (!isClientsStoreConfigured()) return;
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
  if (!isClientsStoreConfigured()) return;
  const { data: rows, error } = await db()
    .from(TABLE)
    .select("id, email")
    .in("id", projectIds);
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
  if (!isClientsStoreConfigured()) return;
  await applyBundle([projectId], null, null);
}

// Permanently delete one project row (admin-only). No-ops cleanly when the
// store isn't configured. Bundle siblings are unaffected — only this row goes.
export async function deleteClient(id: string): Promise<void> {
  if (!isClientsStoreConfigured()) return;
  const { error } = await db().from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
