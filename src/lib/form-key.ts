// The key on a project's form links (the planning questionnaire, and the
// inquiry form for a project with no service yet). With the right key, the
// form opens with what the project already knows about the client, read here
// on the server, so their email and phone never ride in the address, where
// logs and analytics would keep them. The key is derived from the project id
// and AUTH_SECRET; without the secret there's no key, and the form opens
// empty but still attaches to the project by its id. Server-only.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { getClientFull, isRecordId } from "@/lib/clients";

export function formKey(projectId: string): string | undefined {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || !projectId) return undefined;
  return createHmac("sha256", secret).update(`form:${projectId}`).digest("hex").slice(0, 16);
}

export function formKeyMatches(projectId: string, key: string | undefined): boolean {
  const expected = formKey(projectId);
  // Anything but 16 hex characters is no key (and never reaches the compare,
  // which needs equal byte lengths).
  if (!expected || !key || !/^[0-9a-f]{16}$/.test(key)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(key));
}

// What a form opens with for this project: the client's name, email, phone,
// partner, date and guest count, in the form's own field names. Empty for a
// wrong or missing key, or when the project can't be read (reported).
export async function knownDetails(
  projectId: string | undefined,
  key: string | undefined,
  route: string,
): Promise<Record<string, string>> {
  if (!projectId || !isRecordId(projectId) || !formKeyMatches(projectId, key)) return {};
  try {
    const r = await getClientFull(projectId);
    if (!r) return {};
    const known: Record<string, string | undefined> = {
      fullName: r.clientName,
      email: r.email,
      phone: r.phone,
      partnerFullName: r.partnerName,
      eventDate: r.eventDate,
      guestCount: r.guestCount != null ? String(r.guestCount) : undefined,
    };
    return Object.fromEntries(Object.entries(known).filter((e): e is [string, string] => !!e[1]?.trim()));
  } catch (err) {
    Sentry.captureException(err, { tags: { route, stage: "prefill" }, level: "warning" });
    return {};
  }
}
