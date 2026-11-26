// POST /api/admin/update: owner-only edits to one project. The record id comes
// from the body (the owner may edit any record). A request carries the edit
// form's fields, one change to the project's links and files (add an entry,
// remove one, or change one, like an invoice marked paid), or the discovery
// call's notes: an autosave of answers and notes, or the summary saved after
// the call. The summary's first save moves a lead to In conversation and,
// before a proposal has gone out, sets a follow-up to send the recap, then
// marks the call held; saving it again changes only the summary. An autosave
// names the save it was typed against and the open copy it came from, and is
// refused (409) when another copy saved the notes since. It also takes a
// follow-up set, moved or cleared (from the project page or the Today list),
// a Today row marked handled or snoozed, a dated note for the activity log,
// and a pipeline email noted as sent another way. Removing an entry takes it off the project; an uploaded file itself
// stays in storage. Nothing here emails the client; telling them is a Compose
// email.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import {
  addDocument,
  addNote,
  advanceStatus,
  dismissToday,
  patchDocument,
  removeDocument,
  saveCall,
  setFollowUp,
  updateClientAdmin,
} from "@/lib/clients";
import { CALL_ANSWER_MAX, CALL_NOTES_MAX, SUMMARY_PART_MAX } from "@/lib/calls";
import {
  CLIENT_STATUS_OPTIONS,
  CLIENT_STATUS_TERMINAL,
  statusRank,
  type ClientStatus,
} from "@/lib/client-status";
import { shiftDay, studioToday } from "@/lib/field-format";
import { OWNER_DOCUMENT_TYPES, PAYMENT_METHODS } from "@/lib/labels";
import { EMAIL_TEMPLATES } from "@/lib/email/email-pipeline";
import { notedAsSent } from "@/lib/next-step";

const TEMPLATE_IDS = EMAIL_TEMPLATES.map((t) => t.id) as [string, ...string[]];
const STATUS_VALUES = CLIENT_STATUS_OPTIONS.map((o) => o.value) as [ClientStatus, ...ClientStatus[]];
const OWNER_KINDS = OWNER_DOCUMENT_TYPES.map((t) => t.value) as [string, ...string[]];
const METHODS = PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]];

// A link the client will open: a web address, never a javascript: or data: one.
const webUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => /^https?:\/\//i.test(u));
const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// "<section>.<question>" or "tailored.<id>", as src/lib/discovery-guides.ts
// keys answers.
const answerKey = z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+$/).max(100);
const summaryPart = z.string().max(SUMMARY_PART_MAX);
const documentId = z.string().min(1).max(100);
const documentLabel = z.string().trim().min(1).max(200);

const schema = z.object({
  id: z.string().min(1),
  fields: z
    .object({
      clientName: z.string().max(200).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      partnerName: z.string().max(200).optional(),
      status: z.enum(STATUS_VALUES).optional(),
      serviceType: z.string().max(100).optional(),
      package: z.string().max(200).optional(),
      eventDate: z.string().max(100).optional(),
      guestCount: z.coerce.number().int().min(0).max(1000000).optional(),
      budget: z.string().max(100).optional(),
      planSummary: z.string().max(10000).optional(),
      projectName: z.string().max(200).optional(),
      // How the client will pay; an empty value clears the choice.
      paymentMethod: z.union([z.enum(METHODS), z.literal("")]).optional(),
      // Venue / address rows (admin-editable; persisted to the locations JSONB).
      locations: z
        .array(
          z.object({
            label: z.string().max(300).optional(),
            address: z.string().max(500).optional(),
            notes: z.string().max(1000).optional(),
          }),
        )
        .max(20)
        .optional(),
    })
    .optional(),
  addDocument: z
    .object({
      type: z.enum(OWNER_KINDS),
      label: documentLabel,
      url: webUrl,
      // Invoices only: the day payment is due.
      dueAt: calendarDay.optional(),
    })
    .optional(),
  removeDocumentId: documentId.optional(),
  // The discovery call's notes as typed: only the answers that changed, the
  // question each was typed under, the save they were typed against, and the
  // open copy of the Call tab they came from with its count of saves.
  call: z
    .object({
      answers: z.record(answerKey, z.string().max(CALL_ANSWER_MAX)).optional(),
      asked: z.record(answerKey, z.string().max(1000)).optional(),
      notes: z.string().max(CALL_NOTES_MAX).optional(),
      base: z.string().max(40).optional(),
      writer: z.string().max(64).optional(),
      seq: z.number().int().min(1).optional(),
    })
    .optional(),
  // The summary written after the call.
  callSummary: z
    .object({
      background: summaryPart,
      event: summaryPart,
      priorities: summaryPart,
      logistics: summaryPart,
      actions: summaryPart,
    })
    .optional(),
  // The follow-up set, moved or (with a null day) cleared. `expect` names the
  // follow-up the change was made against (null for none): it changes only
  // while that one is still the project's.
  followUp: z
    .object({
      at: calendarDay.nullable(),
      note: z.string().trim().max(200).optional(),
      expect: calendarDay.nullable().optional(),
    })
    .optional(),
  // A note added to the activity log.
  note: z.string().trim().min(1).max(2000).optional(),
  // A pipeline email the owner sent another way (Already sent on the next
  // step): noted in the log, and the project moved on as sending it would.
  sent: z.enum(TEMPLATE_IDS).optional(),
  // A Today row marked handled, or snoozed until a day.
  dismiss: z
    .object({
      key: z.string().min(1).max(200),
      until: calendarDay.optional(),
    })
    .optional(),
  // A null clears that date (an invoice marked unpaid again).
  patchDocument: z
    .object({
      id: documentId,
      label: documentLabel.optional(),
      dueAt: calendarDay.nullable().optional(),
      paidAt: calendarDay.nullable().optional(),
    })
    .optional(),
});

export const POST = defineRoute({
  route: "admin/update",
  auth: "admin",
  schema,
  invalid: "Invalid input.",
  failure: { status: 500, error: "Couldn't save. Try again." },
  run: async ({
    id,
    fields,
    addDocument: add,
    removeDocumentId,
    patchDocument: patch,
    call,
    callSummary,
    followUp,
    dismiss,
    note,
    sent,
  }) => {
    if (fields) await updateClientAdmin(id, fields);
    if (note && !(await addNote(id, note))) return apiError(404, "That project wasn't found.");
    if (sent) {
      // The move carries the note; with nothing to move, the note goes alone.
      const template = EMAIL_TEMPLATES.find((t) => t.id === sent);
      const name = notedAsSent(template?.name ?? sent);
      const moved = template?.advancesTo ? await advanceStatus(id, template.advancesTo, name) : false;
      if (!moved && !(await addNote(id, name))) return apiError(404, "That project wasn't found.");
    }
    if (followUp && !(await setFollowUp(id, followUp.at, followUp.note, followUp.expect))) {
      return apiError(409, "That follow-up changed since this page loaded.");
    }
    if (dismiss) await dismissToday(id, dismiss.key, dismiss.until ?? "handled");

    // The call's notes. A failed autosave answers an error the panel retries
    // on; it's reported at warning, since the notes are still on screen.
    if (call || callSummary) {
      try {
        let savedAt: string | undefined;
        if (call) {
          const { base, writer, seq, ...patch } = call;
          const saved = await saveCall(id, "discovery", patch, base, writer, seq);
          if (saved?.conflict) {
            return apiError(409, "These notes were saved somewhere else since this page opened.");
          }
          savedAt = saved?.savedAt;
        }
        let held = false;
        let recapFollowUp = false;
        if (callSummary) {
          const saved = await saveCall(id, "discovery", { summary: callSummary });
          // Until the call is marked held, a save moves the project on, and
          // the mark comes last: if a step fails, saving again redoes them.
          if (saved && !saved.conflict && !saved.held) {
            await advanceStatus(id, "in-conversation", "Discovery call held");
            const closed = CLIENT_STATUS_TERMINAL.includes(saved.status as ClientStatus);
            if (!closed && statusRank(saved.status) < statusRank("proposal-sent")) {
              await setFollowUp(
                id,
                shiftDay(studioToday(), { days: 1 }),
                "Send the recap and proposal",
              );
              recapFollowUp = true;
            }
            await saveCall(id, "discovery", { heldAt: new Date().toISOString() });
            held = true;
          }
        }
        return { ok: true, savedAt: savedAt ?? null, held, followUp: recapFollowUp };
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "admin/update", stage: callSummary ? "call-summary" : "call" },
          level: callSummary ? undefined : "warning",
        });
        return apiError(500, "Couldn't save the notes. Try again.");
      }
    }

    try {
      if (add) {
        const { dueAt, ...entry } = add;
        await addDocument(id, {
          ...entry,
          ...(add.type === "invoice" && dueAt ? { dueAt } : {}),
          uploadedBy: "julian",
        });
      }
      if (removeDocumentId) await removeDocument(id, removeDocumentId);
      if (patch) {
        const { id: docId, ...changes } = patch;
        await patchDocument(id, docId, changes);
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "admin/update", stage: "document" },
      });
      return apiError(500, "Couldn't save that link. Try again.");
    }

    return { ok: true };
  },
});
