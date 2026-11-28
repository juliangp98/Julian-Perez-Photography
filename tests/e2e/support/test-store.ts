import type { APIRequestContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Direct access to the test store (the separate Supabase project in .env.test),
// for the suite's reset and for putting a project into a state the site's own
// routes can't reach in a line or two, such as a saved questionnaire. Returns
// null when the test store isn't configured.
export function testStore(): SupabaseClient | null {
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Set columns on one project row directly.
export async function patchProject(id: string, columns: Record<string, unknown>) {
  const db = testStore();
  if (!db) throw new Error("The test store isn't configured (.env.test).");
  const { error } = await db.from("client_records").update(columns).eq("id", id);
  if (error) throw new Error(`Patching the test project failed: ${error.message}`);
}

// Read columns of one project row directly.
export async function readProject(id: string, columns: string): Promise<Record<string, unknown>> {
  const db = testStore();
  if (!db) throw new Error("The test store isn't configured (.env.test).");
  const { data, error } = await db.from("client_records").select(columns).eq("id", id).single();
  if (error) throw new Error(`Reading the test project failed: ${error.message}`);
  return data as unknown as Record<string, unknown>;
}

// Create a project through the site's own route, as the owner (`request` is
// the signed-in adminRequest): a new inquiry from "E2E <tag>" with a unique
// example.com address.
export async function newProject(request: APIRequestContext, tag: string, serviceType = "weddings") {
  const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const email = `e2e-${slug}-${Date.now()}@example.com`;
  const name = `E2E ${tag}`;
  const res = await request.post("/api/admin/create-project", {
    data: { email, clientName: name, serviceType, force: true },
  });
  const { id } = (await res.json()) as { id?: string };
  if (!id) throw new Error(`Creating the test project failed (${res.status()}).`);
  return { id, email, name };
}

// Read, write and clear one of the site's own app_settings values directly.
export async function readSetting(key: string): Promise<unknown> {
  const db = testStore();
  if (!db) throw new Error("The test store isn't configured (.env.test).");
  const { data, error } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`Reading the test setting failed: ${error.message}`);
  return data?.value ?? null;
}

export async function putSetting(key: string, value: unknown) {
  const db = testStore();
  if (!db) throw new Error("The test store isn't configured (.env.test).");
  const { error } = await db.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Writing the test setting failed: ${error.message}`);
}

export async function clearSetting(key: string) {
  const db = testStore();
  if (!db) throw new Error("The test store isn't configured (.env.test).");
  const { error } = await db.from("app_settings").delete().eq("key", key);
  if (error) throw new Error(`Clearing the test setting failed: ${error.message}`);
}

// Add a message to a project's thread directly: a client's reply ("in") or
// the owner's ("out"), sent at a given time.
export async function addMessage(
  projectId: string,
  message: { direction: "in" | "out"; kind?: string; status?: string; sentAt?: string; body?: string },
) {
  const db = testStore();
  if (!db) throw new Error("The test store isn't configured (.env.test).");
  const { error } = await db.from("client_messages").insert({
    project_id: projectId,
    direction: message.direction,
    channel: "email",
    kind: message.kind ?? (message.direction === "in" ? "reply" : "compose"),
    status: message.status ?? (message.direction === "in" ? "received" : "sent"),
    body_text: message.body ?? "A message from the test suite.",
    sent_at: message.sentAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Adding the test message failed: ${error.message}`);
}
