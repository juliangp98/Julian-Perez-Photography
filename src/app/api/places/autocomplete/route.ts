// POST /api/places/autocomplete: public proxy for Google Places autocomplete that
// keeps the API key off the client. Rate-limited because each call bills, and it
// soft-fails to an empty list so a location field stays usable as free text.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { defineRoute } from "@/lib/api-route";
import { fetchPlacePredictions } from "@/lib/places";

export const POST = defineRoute({
  route: "places/autocomplete",
  auth: "public",
  schema: z.object({ input: z.string().min(1).max(200) }),
  // A typeahead fires several times per session; 30/min/IP is generous but
  // bounds a runaway client or abuse.
  rateLimit: { max: 30, windowMs: 60 * 1000 },
  invalid: "Invalid input",
  run: async ({ input }) => {
    try {
      const predictions = await fetchPlacePredictions(input);
      return { predictions };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "places/autocomplete", stage: "fetch" },
        level: "warning",
      });
      // Soft-fail: the field stays usable as free text.
      return { predictions: [] };
    }
  },
});
