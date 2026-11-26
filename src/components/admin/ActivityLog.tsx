// The project's activity log, newest first: each move in the pipeline (the
// status it moved to, and what moved it), and the owner's dated notes, with a
// box to add one. Private: the client never sees it. Server-rendered; the box
// is AddNote.

import { formatDateTime } from "@/lib/field-format";
import { statusTitle } from "@/lib/labels";
import { statusMoves } from "@/lib/client-status";
import type { ClientStatusEntry } from "@/lib/clients";
import AddNote from "@/components/admin/AddNote";

type Line = { key: number; title: string; when: string; note?: string };

// An entry is a move when it changed the status (statusMoves); any other is
// a note.
function lines(history: ClientStatusEntry[]): Line[] {
  const moves = new Set(statusMoves(history));
  return history
    .map((e, i) => ({
      key: i,
      title:
        e.from === "internal-notes"
          ? "Earlier notes"
          : moves.has(e)
            ? statusTitle(e.status) || "Status changed"
            : "Note",
      when: e.from === "internal-notes" ? "" : formatDateTime(e.changedAt),
      note: e.note?.trim() || undefined,
    }))
    .reverse();
}

export default function ActivityLog({
  projectId,
  history,
}: {
  projectId: string;
  history: ClientStatusEntry[];
}) {
  const items = lines(history);
  return (
    <div className="space-y-5">
      <AddNote projectId={projectId} />
      {items.length ? (
        <ol aria-label="Activity" className="divide-y divide-border">
          {items.map((l) => (
            <li key={l.key} className="py-3 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium">{l.title}</span>
                {l.when && <span className="text-xs text-muted">{l.when}</span>}
              </div>
              {l.note && (
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{l.note}</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">Nothing yet.</p>
      )}
    </div>
  );
}
