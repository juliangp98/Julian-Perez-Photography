import { test, expect } from "./support/fixtures";

// Guards on the two upload-token routes. The questionnaire's is public, so it
// only issues a token to a browser on this site, for a questionnaires/ path;
// the portal's needs a signed-in client.

const tokenRequest = (pathname: string) => ({
  type: "blob.generate-client-token",
  payload: { pathname, callbackUrl: "http://localhost:3100/api/questionnaire-upload", clientPayload: null, multipart: false },
});

test("questionnaire upload: a token request without an Origin is refused", async ({ request }) => {
  const res = await request.post("/api/questionnaire-upload", {
    data: tokenRequest("questionnaires/weddings/1700000000000-plan.pdf"),
  });
  expect(res.status()).toBe(403);
});

test("questionnaire upload: a token request from another site is refused", async ({ request }) => {
  const res = await request.post("/api/questionnaire-upload", {
    headers: { origin: "https://evil.example" },
    data: tokenRequest("questionnaires/weddings/1700000000000-plan.pdf"),
  });
  expect(res.status()).toBe(403);
});

test("questionnaire upload: a path outside questionnaires/ is refused", async ({ request }) => {
  // The site's own origin passes the origin check in dev and production builds
  // alike (localhost is allowed only outside production), so the path is what's tested.
  const res = await request.post("/api/questionnaire-upload", {
    headers: { origin: "https://julianperezphotography.com" },
    data: tokenRequest("client-plans/../weddings-day-plan.pdf"),
  });
  expect(res.status()).toBe(400);
});

test("portal upload: needs a signed-in client", async ({ request }) => {
  const res = await request.post("/api/portal/upload", {
    data: tokenRequest("portal/x/1700000000000-doc.pdf"),
  });
  expect(res.status()).toBe(401);
});
