export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { rateLimitResponse } from "@/lib/request-guard";
import { fetchPlacePredictions } from "@/lib/places";

// Server proxy for Google Places (New) autocomplete — keeps GOOGLE_PLACES_API_KEY
// off the client. Rate-limited because each call bills; soft-fails to an empty
// list so a location field always stays usable as free text.
const schema = z.object({ input: z.string().min(1).max(200) });

export async function POST(req: Request) {
  // A typeahead fires several times per session; 30/min/IP is generous but
  // bounds a runaway client or abuse.
  const limited = rateLimitResponse(req, {
    key: "places",
    max: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const predictions = await fetchPlacePredictions(parsed.data.input);
    return NextResponse.json({ predictions });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "places-autocomplete", stage: "fetch" },
      level: "warning",
    });
    // Soft-fail — the field stays usable as free text.
    return NextResponse.json({ predictions: [] });
  }
}
