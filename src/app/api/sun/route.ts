export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import SunCalc from "suncalc";
import tzlookup from "tz-lookup";
import { rateLimitResponse } from "@/lib/request-guard";
import { geocodeAddress } from "@/lib/places";

// Suggests the ideal golden-hour session time for a wedding from the event date
// and venue: geocode the venue → coordinates, look up its IANA timezone, compute
// the real sunset there, and return a start time ~25 min before it, expressed in
// the venue's own local clock. Powers the auto-default on the wedding
// questionnaire's "sunset session time" field (the client can still override).
// Soft-fails to `sessionTime: null` everywhere so it can never break the form.

const schema = z.object({
  address: z.string().min(3).max(400),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Minutes before sunset to start, so the couple is lit by the warm low sun
// rather than shooting into the dark — matches the field's existing guidance.
const LEAD_MINUTES = 25;

// Format an absolute instant as 24-hour "HH:MM" in a specific IANA zone — the
// value shape a native <input type="time"> expects.
function clockInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(instant)
    .replace(/^24:/, "00:"); // some runtimes render midnight as 24:xx
}

export async function POST(req: Request) {
  const limited = rateLimitResponse(req, {
    key: "sun",
    max: 30,
    windowMs: 10 * 60 * 1000,
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
    const coords = await geocodeAddress(parsed.data.address);
    if (!coords) return NextResponse.json({ ok: true, sessionTime: null });

    const timeZone = tzlookup(coords.lat, coords.lng);
    // Noon-UTC anchor picks the correct calendar day for sunset regardless of
    // the venue's offset from UTC.
    const dayAnchor = new Date(`${parsed.data.date}T12:00:00Z`);
    const sunset = SunCalc.getTimes(dayAnchor, coords.lat, coords.lng).sunset;
    if (Number.isNaN(sunset.getTime())) {
      // Polar day/night — no sunset on this date at this latitude.
      return NextResponse.json({ ok: true, sessionTime: null });
    }
    const start = new Date(sunset.getTime() - LEAD_MINUTES * 60_000);

    return NextResponse.json({
      ok: true,
      sessionTime: clockInZone(start, timeZone),
      sunsetTime: clockInZone(sunset, timeZone),
      timeZone,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "sun", stage: "compute" },
      level: "warning",
    });
    return NextResponse.json({ ok: true, sessionTime: null });
  }
}
