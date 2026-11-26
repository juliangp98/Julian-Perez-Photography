"use client";

// The owner's list of a project's links and files: the proposal, contract,
// invoice, highlights and gallery links Julian adds, plus anything the client
// uploaded. Adds a link or uploads a file (the shared UploadButton), removes
// one, and marks an invoice paid. Every change posts to /api/admin/update and
// refreshes the page; nothing here emails the client.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientDocumentEntry } from "@/lib/clients";
import {
  OWNER_DOCUMENT_TYPES,
  documentType,
  documentTypeLabel,
  invoiceState,
  isUploadedFile,
  uploaderLabel,
} from "@/lib/labels";
import { formatHumanDate, isoFromDate, STUDIO_TIME_ZONE } from "@/lib/field-format";
import ComposeLink from "@/components/admin/ComposeLink";
import SelectField from "@/components/ui/fields/SelectField";
import TextField from "@/components/ui/fields/TextField";
import DateField from "@/components/ui/fields/DateField";
import Button, { buttonClass } from "@/components/ui/Button";
import UploadButton from "@/components/ui/UploadButton";
import FormStatus from "@/components/ui/FormStatus";

export default function AdminProjectLinks({
  projectId,
  documents,
  announceIds,
}: {
  projectId: string;
  documents: ClientDocumentEntry[];
  // The entries a Compose template would carry: the current link of each kind
  // that has one. Only those offer "Tell the client".
  announceIds: string[];
}) {
  const router = useRouter();
  const [type, setType] = useState(OWNER_DOCUMENT_TYPES[0].value);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // "add" | "upload" | an entry id
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function post(body: Record<string, unknown>, busyKey: string, doneText: string) {
    setBusy(busyKey);
    setError("");
    setDone("");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, ...body }),
      });
      if (!res.ok) throw new Error("request failed");
      setDone(doneText);
      router.refresh();
      return true;
    } catch {
      setError("Couldn't save that. Try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  // The entry to add, with the name falling back to the kind ("Proposal").
  function entry(href: string, fallbackLabel: string) {
    return {
      addDocument: {
        type,
        label: label.trim() || fallbackLabel,
        url: href,
        ...(type === "invoice" && dueAt ? { dueAt } : {}),
      },
    };
  }

  function reset() {
    setLabel("");
    setUrl("");
    setDueAt("");
  }

  async function addLink() {
    const href = url.trim();
    if (!/^https?:\/\/\S+$/i.test(href)) {
      setDone("");
      setError("Enter the full link, starting with https://");
      return;
    }
    if (await post(entry(href, documentTypeLabel(type)), "add", "Added.")) reset();
  }

  // Removing an entry takes it off the project. An uploaded file itself stays
  // in storage, so the question says so.
  function remove(d: ClientDocumentEntry) {
    if (!d.id) return;
    const question = isUploadedFile(d.url)
      ? `Remove "${d.label}" from this project? The file stays in storage, so anyone who has its address can still open it.`
      : `Remove "${d.label}" from this project?`;
    if (!window.confirm(question)) return;
    void post({ removeDocumentId: d.id }, d.id, "Removed.");
  }

  function togglePaid(d: ClientDocumentEntry) {
    if (!d.id) return;
    void post(
      { patchDocument: { id: d.id, paidAt: d.paidAt ? null : isoFromDate() } },
      d.id,
      d.paidAt ? "Marked unpaid." : "Marked paid.",
    );
  }

  return (
    <div>
      {documents.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing here yet. Add the proposal, contract, invoice, highlights or
          gallery link below and the client finds it in their portal.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d, i) => {
            const template =
              d.id && announceIds.includes(d.id)
                ? documentType(d.type)?.template
                : undefined;
            return (
              <li key={d.id ?? `${d.url}-${i}`} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm underline underline-offset-4 hover:text-accent"
                    >
                      {d.label}
                    </a>
                    <div className="text-xs text-muted">
                      {[
                        documentTypeLabel(d.type),
                        uploaderLabel(d.uploadedBy),
                        formatHumanDate(d.uploadedAt, {
                          month: "short",
                          timeZone: STUDIO_TIME_ZONE,
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {d.type === "invoice" && (
                      <div className="text-xs text-muted">{invoiceState(d)}</div>
                    )}
                  </div>
                  {d.id && (
                    <Button
                      variant="text"
                      className="whitespace-nowrap"
                      loading={busy === d.id}
                      loadingLabel="Saving…"
                      onClick={() => remove(d)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {(template || (d.type === "invoice" && d.id)) && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {d.type === "invoice" && d.id && (
                      <Button
                        variant="text"
                        disabled={busy === d.id}
                        onClick={() => togglePaid(d)}
                      >
                        {d.paidAt ? "Mark unpaid" : "Mark paid"}
                      </Button>
                    )}
                    {template && (
                      // The entry's id rides along, so this is its own
                      // hand-off, apart from one on the same template.
                      <ComposeLink
                        href={`?compose=${template}&doc=${d.id}#compose`}
                        className={buttonClass("text")}
                      >
                        Tell the client
                      </ComposeLink>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Add a link or file</h3>
        <SelectField
          id="link-type"
          label="Kind"
          value={type}
          onChange={setType}
          options={OWNER_DOCUMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <TextField
          id="link-label"
          label="Shown as (optional)"
          value={label}
          onChange={setLabel}
          placeholder={documentTypeLabel(type)}
        />
        <TextField
          id="link-url"
          label="Link"
          type="url"
          value={url}
          onChange={setUrl}
          placeholder="https://…"
        />
        {type === "invoice" && (
          <DateField id="link-due" label="Due (optional)" value={dueAt} onChange={setDueAt} />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={addLink}
            disabled={!url.trim() || busy === "upload"}
            loading={busy === "add"}
            loadingLabel="Adding…"
          >
            Add link
          </Button>
          <UploadButton
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onStart={() => {
              setBusy("upload");
              setError("");
              setDone("");
            }}
            onUploaded={async (file) => {
              if (await post(entry(file.url, file.name), "upload", "Uploaded.")) reset();
            }}
            onError={() => {
              setBusy(null);
              setError("Upload failed. Try again.");
            }}
          >
            Upload a file instead
          </UploadButton>
        </div>
        <FormStatus
          state={error ? "error" : done ? "ok" : "idle"}
          ok={done}
          error={error}
          className="block"
        />
        <p className="text-xs text-muted">
          Adding highlights moves the project to Editing, and the gallery to
          Delivered. Nothing is emailed: use Compose to tell the client.
        </p>
      </div>
    </div>
  );
}
