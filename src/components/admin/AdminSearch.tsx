"use client";

// Plain-English search over client projects: /api/admin/search turns the query
// into a structured filter and returns the matches with a note on how it read
// the query. Rendered on /admin/projects only when AI is configured.

import { useState } from "react";
import Link from "next/link";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";

type Match = {
  id: string;
  name: string;
  clientName: string | null;
  status: string | null;
  statusTitle: string | null;
  serviceType: string | null;
  eventDate: string | null;
};

type Status = "idle" | "searching" | "done" | "error";

export default function AdminSearch() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || status === "searching") return;
    setStatus("searching");
    try {
      const res = await fetch("/api/admin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.searched) {
        setSummary(data.summary ?? "");
        setMatches((data.matches ?? []) as Match[]);
        setStatus("done");
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  function clear() {
    setQuery("");
    setMatches(null);
    setSummary("");
    setStatus("idle");
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask in plain English, e.g. “weddings in June with no contract yet”"
          aria-label="Search projects in plain English"
          className="flex-1 min-w-[16rem] px-4 py-2.5 rounded border border-border bg-white text-sm focus:outline-none focus:border-foreground transition"
        />
        <Button
          variant="secondary"
          type="submit"
          loading={status === "searching"}
          loadingLabel="Searching…"
          disabled={!query.trim()}
        >
          Search
        </Button>
        {matches && (
          <Button variant="secondary" onClick={clear}>
            Clear
          </Button>
        )}
      </form>

      <FormStatus state={status} error="Couldn't search. Try again." className="mt-3 block" />

      {matches && (
        <div className="mt-4">
          <p className="text-sm text-muted">
            {matches.length} project{matches.length === 1 ? "" : "s"}
            {summary ? ` · ${summary}` : ""}
          </p>
          {matches.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {matches.map((m) => (
                <li key={m.id} className="py-2">
                  <Link
                    href={`/admin/projects/${m.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 hover:text-accent"
                  >
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-muted">
                      {[
                        m.statusTitle,
                        m.serviceType,
                        m.eventDate,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
