"use client";

// The board's one search box. "Search" narrows the board to projects whose
// name, email or service contains the words (the page reads ?q= and
// ?service=). "Ask", when AI is set up, reads the words as a plain-English
// question instead (/api/admin/search) and lists the projects that answer it,
// with how it read the question.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Select from "@/components/ui/fields/Select";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import { compactInputClass } from "@/components/ui/fields/Field";

type Match = {
  id: string;
  name: string;
  statusTitle: string | null;
  serviceType: string | null;
  eventDate: string | null;
};

export default function ProjectSearch({
  initialQuery,
  initialService,
  services,
  canAsk,
  filtered,
}: {
  initialQuery: string;
  initialService: string;
  // The services in play, for the dropdown: slug and title.
  services: { value: string; label: string }[];
  canAsk: boolean;
  // Whether the board is narrowed now, to offer Clear.
  filtered: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [service, setService] = useState(initialService);
  const [status, setStatus] = useState<"idle" | "asking" | "done" | "error">("idle");
  const [summary, setSummary] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (service) params.set("service", service);
    setMatches(null);
    router.push(`/admin/projects${params.size ? `?${params}` : ""}`);
  }

  async function ask() {
    if (!query.trim() || status === "asking") return;
    setStatus("asking");
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

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            canAsk
              ? "Search a name or email, or ask: “weddings in June with no contract yet”"
              : "Search a name, email or service"
          }
          aria-label="Search projects"
          className={`flex-1 min-w-[16rem] ${compactInputClass}`}
        />
        {services.length > 0 && (
          <Select
            density="compact"
            value={service}
            onChange={(e) => setService(e.target.value)}
            aria-label="Filter by service"
          >
            <option value="">All services</option>
            {services.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
        <Button type="submit" size="sm">
          Search
        </Button>
        {canAsk && (
          <Button
            variant="secondary"
            size="sm"
            onClick={ask}
            disabled={!query.trim()}
            loading={status === "asking"}
            loadingLabel="Asking…"
          >
            Ask
          </Button>
        )}
        {(filtered || matches) && (
          <Button
            variant="text"
            onClick={() => {
              setQuery("");
              setService("");
              setMatches(null);
              setStatus("idle");
              if (filtered) router.push("/admin/projects");
            }}
          >
            Clear
          </Button>
        )}
      </form>
      <FormStatus state={status === "error" ? "error" : "idle"} error="Couldn't search. Try again." className="block" />

      {matches && (
        <div>
          <p className="text-sm text-muted">
            {matches.length} project{matches.length === 1 ? "" : "s"}
            {summary ? ` · ${summary}` : ""}
          </p>
          {matches.length > 0 && (
            <ul className="mt-2 divide-y divide-border">
              {matches.map((m) => (
                <li key={m.id} className="py-2">
                  <Link
                    href={`/admin/projects/${m.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 hover:text-accent"
                  >
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-muted">
                      {[m.statusTitle, m.serviceType, m.eventDate].filter(Boolean).join(" · ")}
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
