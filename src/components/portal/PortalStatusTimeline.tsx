// A client-facing progress timeline for one project: the twelve internal
// pipeline statuses collapse into six milestones (see `client-status.ts`),
// rendered as a stepper with a warm "what's next" hint and, when the event date
// is known and upcoming, a friendly countdown. Presentational + server-rendered;
// hidden entirely for terminal (closed) statuses.

import { CLIENT_MILESTONES, clientMilestoneIndex } from "@/lib/client-status";
import Panel from "@/components/ui/Panel";

// Parse an event-date string (ISO "2026-10-10", "10/10/2026", "Aug 15, 2027").
// Returns null for unparseable values so the countdown simply doesn't render.
function daysUntil(d?: string): number | null {
  if (!d) return null;
  let date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function countdownLabel(days: number | null): string | null {
  if (days === null || days < 0) return null;
  if (days === 0) return "Today's the day!";
  if (days === 1) return "Tomorrow!";
  return `${days} days to go`;
}

export default function PortalStatusTimeline({
  status,
  eventDate,
}: {
  status?: string;
  eventDate?: string;
}) {
  const current = clientMilestoneIndex(status);
  if (current < 0) return null; // terminal/closed — no timeline

  const countdown = countdownLabel(daysUntil(eventDate));

  return (
    <Panel className="mt-8 lg:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Where things stand
        </div>
        {countdown && (
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
            {countdown}
          </div>
        )}
      </div>

      <ol className="mt-5 flex items-start">
        {CLIENT_MILESTONES.map((m, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={m.key}
              className="relative flex flex-1 flex-col items-center"
            >
              {/* connector — left half (reached this step) */}
              {i > 0 && (
                <span
                  className={`absolute top-[7px] left-0 right-1/2 h-0.5 ${
                    i <= current ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                  }`}
                />
              )}
              {/* connector — right half (past this step) */}
              {i < CLIENT_MILESTONES.length - 1 && (
                <span
                  className={`absolute top-[7px] left-1/2 right-0 h-0.5 ${
                    i < current ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                  }`}
                />
              )}
              {/* milestone dot */}
              <span
                className={`relative z-10 h-4 w-4 rounded-full border-2 ${
                  done
                    ? "border-[var(--accent)] bg-[var(--accent)]"
                    : active
                      ? "border-[var(--accent)] bg-white ring-2 ring-[var(--accent)]/30"
                      : "border-[var(--border)] bg-white"
                }`}
              />
              <span
                className={`mt-2 text-center text-[10px] uppercase tracking-wide sm:text-xs ${
                  i <= current
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {m.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-sm text-[var(--muted)]">
        {CLIENT_MILESTONES[current].hint}
      </p>
    </Panel>
  );
}
