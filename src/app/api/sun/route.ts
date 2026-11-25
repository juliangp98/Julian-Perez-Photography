// POST /api/sun: public. Suggests a golden-hour session start (25 min before the
// venue's real sunset, in the venue's local clock) for the wedding questionnaire.
// Soft-fails to `sessionTime: null` everywhere so it can never break the form.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import SunCalc from "suncalc";
import tzlookup from "tz-lookup";
import { defineRoute } from "@/lib/api-route";
import { geocodeAddress } from "@/lib/places";

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

export const POST = defineRoute({
  route: "sun",
  auth: "public",
  schema,
  rateLimit: { max: 30, windowMs: 10 * 60 * 1000 },
  invalid: "Invalid input",
  run: async ({ address, date }) => {
    try {
      const coords = await geocodeAddress(address);
      if (!coords) return { ok: true, sessionTime: null };

      const timeZone = tzlookup(coords.lat, coords.lng);
      // Noon-UTC anchor picks the correct calendar day for sunset regardless of
      // the venue's offset from UTC.
      const dayAnchor = new Date(`${date}T12:00:00Z`);
      const sunset = SunCalc.getTimes(dayAnchor, coords.lat, coords.lng).sunset;
      if (Number.isNaN(sunset.getTime())) {
        // Polar day/night: no sunset on this date at this latitude.
        return { ok: true, sessionTime: null };
      }
      const start = new Date(sunset.getTime() - LEAD_MINUTES * 60_000);

      return {
        ok: true,
        sessionTime: clockInZone(start, timeZone),
        sunsetTime: clockInZone(sunset, timeZone),
        timeZone,
      };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "sun", stage: "compute" },
        level: "warning",
      });
      return { ok: true, sessionTime: null };
    }
  },
});
