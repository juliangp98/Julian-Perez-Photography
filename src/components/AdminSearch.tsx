"use client";
import AiButton from "@/components/AiButton";

// Natural-language search over the client projects. Posts a plain-English query
// to /api/admin/search, which the AI turns into a structured filter applied
// server-side, and renders the matching projects with a note on how the query
// was interpreted. Rendered on /admin/projects only when AI is configured.

import { useState } from "react";
import Link from "next/link";

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
    <div className="rounded-lg border border-[var(--border)] bg-white p-5">
      <form onSubmit={submit} className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask in plain English — e.g. “weddings in June with no contract yet”"
          aria-label="Search projects in plain English"
          className="flex-1 min-w-[16rem] px-4 py-2.5 rounded border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--foreground)] transition"
        />
        <AiButton
          type="submit"
          loading={status === "searching"}
          loadingLabel="Searching…"
          disabled={!query.trim()}
        >
          Search
        </AiButton>
        {matches && (
          <button
            type="button"
            onClick={clear}
            className="px-4 py-2.5 text-sm border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
          >
            Clear
          </button>
        )}
      </form>

      {status === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Couldn&rsquo;t search — please try again.
        </p>
      )}

      {matches && (
        <div className="mt-4">
          <p className="text-sm text-[var(--muted)]">
            {matches.length} project{matches.length === 1 ? "" : "s"}
            {summary ? ` · ${summary}` : ""}
          </p>
          {matches.length > 0 && (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {matches.map((m) => (
                <li key={m.id} className="py-2">
                  <Link
                    href={`/admin/projects/${m.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 hover:text-[var(--accent)]"
                  >
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-[var(--muted)]">
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
    </div>
  );
}
