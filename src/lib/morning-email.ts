// The morning email, a stage of the daily job: the Today list's rows sent to
// Julian once a studio day, and only on a day that has any. The day is claimed
// before the send and given back if the send fails, so a second run the same
// day sends nothing more while a failed one can be tried again. A run whose
// mail goes to the safety recipient instead (a preview or local server)
// neither takes the day nor checks it, so previewing the email can't use up
// the real one.

import "server-only";
import * as Sentry from "@sentry/nextjs";
import { claimDay, releaseDay } from "@/lib/app-settings";
import { listClients } from "@/lib/clients";
import { getServices } from "@/lib/content";
import { emailOwner } from "@/lib/email/notify";
import { deliversAsAddressed } from "@/lib/email/send";
import { studioToday } from "@/lib/field-format";
import { morningEmail } from "@/lib/today";
import { todayListFor } from "@/lib/today-list";

const CLAIM = "morning-email";

export type MorningResult = "sent" | "nothing-to-do" | "already-sent";

// Throws when the rows can't be read, the day can't be claimed, or the email
// doesn't go out; the caller reports it.
export async function sendMorningEmail(): Promise<MorningResult> {
  const today = studioToday();
  const [records, services] = await Promise.all([listClients(), getServices()]);
  const email = morningEmail(todayListFor(records, services, today), today);
  if (!email) return "nothing-to-do";

  const guarded = deliversAsAddressed();
  if (guarded && !(await claimDay(CLAIM, today))) return "already-sent";
  try {
    // The key makes a send Resend already accepted, retried after its answer
    // was lost, go out once.
    await emailOwner({ ...email, ...(guarded ? { idempotencyKey: `${CLAIM}/${today}` } : {}) });
  } catch (err) {
    if (guarded) {
      try {
        await releaseDay(CLAIM, today);
      } catch (releaseErr) {
        // The day stays taken: one email can be missed, none doubled.
        Sentry.captureException(releaseErr, {
          tags: { route: "cron/keepalive", stage: "morning-email-release" },
          level: "warning",
        });
      }
    }
    throw err;
  }
  return "sent";
}
