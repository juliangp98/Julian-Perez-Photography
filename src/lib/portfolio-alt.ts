// Persistent per-image alt-text overrides for portfolio galleries. The
// auto-generated manifest (`portfolio-manifest.ts`) supplies a baseline alt;
// these overrides — set from the admin Content tools and stored in Supabase —
// win at render and survive photo re-imports. Server-only (service-role key).
//
// It reuses the same Supabase project as the client store but is a deliberately
// separate, self-contained module so the public portfolio path doesn't depend on
// the CRM code. It no-ops cleanly when Supabase isn't configured, so portfolios
// render fine without it.

import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

const TABLE = "portfolio_image_alt";
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

export function isPortfolioAltStoreConfigured(): boolean {
  return !!url && !!serviceKey;
}

// All alt overrides as { src → alt }. Cached per request; resolves to {} when
// the store isn't configured or on any error, so the gallery quietly falls back
// to the manifest alt.
export const getPortfolioAltOverrides = cache(
  async (): Promise<Record<string, string>> => {
    if (!isPortfolioAltStoreConfigured()) return {};
    try {
      const { data, error } = await db().from(TABLE).select("src, alt");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        const src = (row as { src?: string }).src;
        const alt = (row as { alt?: string }).alt;
        if (src && alt) map[src] = alt;
      }
      return map;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { lib: "portfolio-alt", stage: "read" },
        level: "warning",
      });
      return {};
    }
  },
);

// Upsert one image's alt override. Returns true on a real write, false on a
// no-op (store unconfigured) or error.
export async function setPortfolioAlt(
  src: string,
  alt: string,
): Promise<boolean> {
  if (!isPortfolioAltStoreConfigured()) return false;
  try {
    const { error } = await db()
      .from(TABLE)
      .upsert({ src, alt, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { lib: "portfolio-alt", stage: "write" },
    });
    return false;
  }
}
