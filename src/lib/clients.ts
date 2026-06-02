// Server-only helpers for the private client store (Supabase Postgres).
//
// Client PII lives in a free, private Postgres table (`client_records`) reached
// only through the service-role key — never exposed to the browser. Every
// function gates on `isClientsStoreConfigured()` and no-ops when the store
// isn't wired up, so lead capture + the portal degrade gracefully on a deploy
// without the Supabase env.
//
// Privacy boundary: `SAFE_SELECT` is the portal projection — it omits
// `internal_notes`, `questionnaire_snapshot`, `status_history`, inquiry
// context, and meta timestamps, so those never reach a client. Admin reads /
// edits happen in the Supabase Table Editor, which sees the full row.

import "server-only";
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
  documents?: ClientDocumentEntry[];
  lastClientUpdate?: string;
};

// Column projection for the portal. Columns are aliased snake_case → camelCase.
// internal_notes / questionnaire_snapshot / status_history / inquiry_message /
// referral / source / created_at / updated_at are deliberately NOT selected —
// this is the privacy boundary, enforced at the query.
const SAFE_SELECT =
  "id, clientName:client_name, email, phone, partnerName:partner_name, status, serviceType:service_type, package, eventDate:event_date, secondaryDates:secondary_dates, locations, guestCount:guest_count, budget, planSummary:plan_summary, documents, lastClientUpdate:last_client_update";

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
  const { data, error } = await db()
    .from(TABLE)
    .select(SAFE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ClientRecordSafe | null) ?? null;
}

export async function findClientIdByEmail(
  email: string,
): Promise<string | null> {
  if (!isClientsStoreConfigured()) return null;
  const { data, error } = await db()
    .from(TABLE)
    .select("id")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

// ── Writes ──

// Create or update a record from an inquiry. Matches by normalized email; on an
// existing record we only fill blank fields + bump the timestamp (never clobber
// a curated field or an advanced status). New records start at `new-inquiry`.
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
}): Promise<string | null> {
  if (!isClientsStoreConfigured()) return null;
  const email = normalizeEmail(input.email);
  const ts = nowIso();

  const { data: existing, error: selErr } = await db()
    .from(TABLE)
    .select("id, phone, service_type, event_date, budget, referral, inquiry_message")
    .eq("email", email)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing?.id) {
    const patch: Record<string, unknown> = { updated_at: ts };
    if (!existing.phone && input.phone) patch.phone = input.phone;
    if (!existing.service_type && input.service) patch.service_type = input.service;
    if (!existing.event_date && input.eventDate) patch.event_date = input.eventDate;
    if (!existing.budget && input.budget) patch.budget = input.budget;
    if (!existing.referral && input.referral) patch.referral = input.referral;
    if (!existing.inquiry_message && input.message) patch.inquiry_message = input.message;
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

// Attach a questionnaire submission to the matching record (creating one if
// none exists), snapshot the answers, link the generated PDF, and advance the
// status toward "planning" without regressing a further-along record.
export async function attachQuestionnaire(input: {
  name?: string;
  email: string;
  service?: string;
  answersJson: string;
  pdf?: { label: string; url: string };
}): Promise<string | null> {
  if (!isClientsStoreConfigured()) return null;
  const email = normalizeEmail(input.email);
  const ts = nowIso();

  const { data: existing, error: selErr } = await db()
    .from(TABLE)
    .select("id, service_type")
    .eq("email", email)
    .maybeSingle();
  if (selErr) throw selErr;

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
      updated_at: ts,
    };
    if (!existing?.service_type && input.service) patch.service_type = input.service;
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
const CLIENT_EDITABLE = ["phone", "partnerName", "guestCount", "planSummary"] as const;
const EDITABLE_COLUMN: Record<(typeof CLIENT_EDITABLE)[number], string> = {
  phone: "phone",
  partnerName: "partner_name",
  guestCount: "guest_count",
  planSummary: "plan_summary",
};
export type ClientEditableFields = Partial<{
  phone: string;
  partnerName: string;
  guestCount: number;
  planSummary: string;
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
