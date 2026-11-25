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
