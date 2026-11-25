import { createClient } from "@supabase/supabase-js";

// Runs once before the suite (globalSetup). With the test store configured, it
// clears what earlier runs left behind:
// - projects on reserved test domains (example.com, *.test), which covers every
//   address the specs use; their messages go with them (on delete cascade).
//   Reserved domains never belong to a real client, so a TEST_SUPABASE_URL
//   pointed at the wrong project can't lose real projects. Only rows over an
//   hour old go, so a run going on at the same time against the same store (CI
//   and a local run, say) keeps its own;
// - alt-text overrides saved for the e2e-only image path (/portfolio/e2e/).
// Specs don't depend on an empty store: each creates the records it asserts on,
// and the cron spec settles the stored AI model choice itself.
export default async function resetTestStore() {
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const steps = [
    db.from("client_records").delete().ilike("email", "%@example.com").lt("created_at", anHourAgo),
    db.from("client_records").delete().ilike("email", "%.test").lt("created_at", anHourAgo),
    db.from("portfolio_image_alt").delete().like("src", "/portfolio/e2e/%"),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw new Error(`Resetting the test store failed: ${error.message}`);
  }
}
