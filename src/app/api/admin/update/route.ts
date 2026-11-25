// POST /api/admin/update: owner-only edits to one project. The record id comes
// from the body (the owner may edit any record). A request carries the edit
// form's fields, or one change to the project's links and files: add an entry,
// remove one, or change one (an invoice marked paid). Removing an entry takes
// it off the project; an uploaded file itself stays in storage. Nothing here
// emails the client; telling them is a Compose email.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import {
  addDocument,
  patchDocument,
  removeDocument,
  updateClientAdmin,
} from "@/lib/clients";
import { OWNER_DOCUMENT_TYPES, PAYMENT_METHODS } from "@/lib/labels";

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
      status: z.string().max(50).optional(),
      serviceType: z.string().max(100).optional(),
      package: z.string().max(200).optional(),
      eventDate: z.string().max(100).optional(),
      guestCount: z.coerce.number().int().min(0).max(1000000).optional(),
      budget: z.string().max(100).optional(),
      planSummary: z.string().max(10000).optional(),
      internalNotes: z.string().max(10000).optional(),
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
  run: async ({ id, fields, addDocument: add, removeDocumentId, patchDocument: patch }) => {
    if (fields) await updateClientAdmin(id, fields);

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
