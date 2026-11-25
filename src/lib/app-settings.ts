// Small values the site keeps for itself in app_settings (service-role only):
// the AI model choice, and the last known state of each automation so the
// owner hears when one changes rather than every day it doesn't.

import "server-only";
import * as Sentry from "@sentry/nextjs";
import { db, isClientsStoreConfigured } from "@/lib/clients";
import { getSiteSettings } from "@/lib/content";
import { sendEmail } from "@/lib/email/send";

export async function getSetting<T>(key: string): Promise<T | null> {
  if (!isClientsStoreConfigured()) return null;
  const { data, error } = await db().from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value as T | undefined) ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  if (!isClientsStoreConfigured()) return;
  const { error } = await db()
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Emails the owner when `state` differs from the last one recorded for `key`.
// The first state seen is recorded quietly unless it's a problem. Never throws:
// a notice is a side effect of whatever just ran.
export async function noteOwnerOnChange(
  key: string,
  state: { ok: boolean; summary: string },
  message: { subject: string; text: string },
): Promise<void> {
  try {
    const settingKey = `notice:${key}`;
    const previous = await getSetting<{ ok: boolean; summary: string }>(settingKey);
    if (previous?.summary === state.summary) return;
    await setSetting(settingKey, state);
    if (!previous && state.ok) return;
    const settings = await getSiteSettings();
    await sendEmail({ to: process.env.INQUIRY_TO || settings.contactEmail, ...message });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "owner-notice", stage: key }, level: "warning" });
  }
}
