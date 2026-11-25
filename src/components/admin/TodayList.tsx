"use client";

// The Today list at the top of the projects board (rows from src/lib/today.ts):
// each row says why it's there, offers one thing to do, and can be marked
// handled or snoozed. A follow-up row's "Mark handled" clears the follow-up
// and its "Snooze" moves it, only while it's still the one shown; any other
// row is marked on the project, so the same rule firing for something new
// shows again. Posts to /api/admin/update and refreshes the board.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import Button, { buttonClass } from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { shiftDay } from "@/lib/field-format";
import type { TodayRow } from "@/lib/today";

const SNOOZE_DAYS = 3;

export default function TodayList({ rows, today }: { rows: TodayRow[]; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  async function act(row: TodayRow, how: "handled" | "snooze") {
    const until = shiftDay(today, { days: SNOOZE_DAYS });
    const body =
      row.rule === "follow-up"
        ? { followUp: { at: how === "handled" ? null : until, expect: row.due } }
        : { dismiss: { key: row.key, ...(how === "snooze" ? { until } : {}) } };
    setBusy(`${row.projectId}|${row.key}`);
    setError("");
    setDone("");
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.projectId, ...body }),
      });
      if (res.status === 409) {
        setError("That follow-up changed since the page loaded. Here's the list as it is now.");
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error();
      setDone(how === "handled" ? "Marked handled." : `Snoozed for ${SNOOZE_DAYS} days.`);
      router.refresh();
    } catch {
      setError("Couldn't save that. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="today-heading">
      <Panel tone="accent" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="today-heading" className="font-serif text-2xl">Today</h2>
          <FormStatus state={error ? "error" : done ? "ok" : "idle"} ok={done} error={error} />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Nothing needs you right now.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const id = `${row.projectId}|${row.key}`;
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/projects/${row.projectId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.projectName}
                    </Link>
                    <p className="text-sm text-muted">{row.reason}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={row.action.href} className={buttonClass("secondary", "sm")}>
                      {row.action.label}
                    </Link>
                    <Button
                      variant="text"
                      disabled={busy === id}
                      onClick={() => act(row, "handled")}
                    >
                      Mark handled
                    </Button>
                    <Button
                      variant="text"
                      disabled={busy === id}
                      onClick={() => act(row, "snooze")}
                    >
                      Snooze
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </section>
  );
}
