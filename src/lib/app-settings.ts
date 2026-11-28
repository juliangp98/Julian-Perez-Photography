// Small values the site keeps for itself in app_settings (service-role only):
// the AI model choice, the last known state of each automation so the owner
// hears when one changes rather than every day it doesn't, and the day each
// daily email last went.

import "server-only";
import * as Sentry from "@sentry/nextjs";
import { db, isClientsStoreConfigured } from "@/lib/clients";
import { getSiteSettings } from "@/lib/content";
import { sendEmail } from "@/lib/email/send";
import { ownerAddress } from "@/lib/email/notify";

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
    await sendEmail({ to: ownerAddress(settings), ...message, sender: "site" });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "owner-notice", stage: key }, level: "warning" });
  }
}

// Claims a studio day for something done once a day (`name:<day>`): true for
// the first claim, false when that day is already taken. A plain insert, so
// two runs at once can't both win. Earlier days' claims are cleared after a
// claim; a failure there is only reported. Throws when the store can't answer.
export async function claimDay(name: string, day: string): Promise<boolean> {
  const key = `${name}:${day}`;
  const { error } = await db().from("app_settings").insert({ key, value: true });
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(`Claiming ${key} failed: ${error.message}`);
  }
  const pruned = await db().from("app_settings").delete().like("key", `${name}:%`).lt("key", key);
  if (pruned.error) {
    Sentry.captureException(new Error(`Clearing earlier ${name} claims failed: ${pruned.error.message}`), {
      tags: { route: "app-settings", stage: "prune" },
      level: "warning",
    });
  }
  return true;
}

// Gives a claimed day back, so a later run can try again.
export async function releaseDay(name: string, day: string): Promise<void> {
  const { error } = await db().from("app_settings").delete().eq("key", `${name}:${day}`);
  if (error) throw new Error(`Releasing ${name}:${day} failed: ${error.message}`);
}
