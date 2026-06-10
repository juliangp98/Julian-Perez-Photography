"use client";
import AiButton from "@/components/ui/AiButton";

// Draft or tighten the marketing copy (tagline, description, intro) for a service
// or portfolio page with AI, from the copy that's currently live. Calls
// /api/admin/draft-copy and shows the result, copyable, for Julian to paste into
// Sanity Studio. The AI never publishes.

import { useState } from "react";
import CopyField from "@/components/ui/CopyField";
import { inputClass } from "@/components/ui/fields/Field";

export type CopySubject = {
  kind: "service" | "portfolio";
  slug: string;
  title: string;
};

type Mode = "tighten" | "rewrite" | "fresh";
type Status = "idle" | "drafting" | "drafted" | "error";
type Copy = { tagline: string; description: string; intro: string[] };

const input = `${inputClass} text-sm`;

const MODES: { value: Mode; label: string }[] = [
  { value: "tighten", label: "Tighten the current copy" },
  { value: "rewrite", label: "Rewrite it fresh" },
  { value: "fresh", label: "Draft from scratch" },
];

export default function CopyPolisher({
  subjects,
}: {
  subjects: CopySubject[];
}) {
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<Mode>("tighten");
  const [angle, setAngle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [copy, setCopy] = useState<Copy | null>(null);

  const services = subjects.filter((s) => s.kind === "service");
  const portfolios = subjects.filter((s) => s.kind === "portfolio");

  async function polish() {
    if (!selected || status === "drafting") return;
    const [kind, ...rest] = selected.split(":");
    const slug = rest.join(":");
    setStatus("drafting");
    try {
      const res = await fetch("/api/admin/draft-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slug, mode, angle: angle.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.drafted && data.copy) {
        setCopy(data.copy as Copy);
        setStatus("drafted");
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cp-subject" className="block text-sm font-medium mb-1.5">
            Page
          </label>
          <select
            id="cp-subject"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={input}
          >
            <option value="">Choose a page…</option>
            <optgroup label="Services">
              {services.map((s) => (
                <option key={`service:${s.slug}`} value={`service:${s.slug}`}>
                  {s.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Portfolios">
              {portfolios.map((s) => (
                <option key={`portfolio:${s.slug}`} value={`portfolio:${s.slug}`}>
                  {s.title}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="cp-mode" className="block text-sm font-medium mb-1.5">
            What to do
          </label>
          <select
            id="cp-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className={input}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="cp-angle" className="block text-sm font-medium mb-1.5">
          Angle / emphasis{" "}
          <span className="text-[var(--muted)] font-normal">(optional)</span>
        </label>
        <input
          id="cp-angle"
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder="e.g. lean into the documentary style, or emphasize DMV venues"
          className={input}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AiButton
          onClick={polish}
          loading={status === "drafting"}
          loadingLabel="Drafting…"
          disabled={!selected}
        >
          Polish copy
        </AiButton>
        {status === "error" && (
          <span role="alert" className="text-sm text-red-700">
            Couldn&rsquo;t draft — please try again.
          </span>
        )}
      </div>

      {copy && (
        <div className="mt-2 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
          {copy.tagline && <CopyField label="Tagline" value={copy.tagline} />}
          {copy.description && (
            <CopyField label="Description" value={copy.description} />
          )}
          {copy.intro.length > 0 && (
            <CopyField label="Intro" value={copy.intro.join("\n\n")} />
          )}
          <p className="text-xs text-[var(--muted)]">
            AI draft — review it, then update the page in Studio. Nothing changes
            on the site until you save it there.
          </p>
        </div>
      )}
    </div>
  );
}
