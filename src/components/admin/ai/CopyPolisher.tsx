"use client";

// Drafts or tightens a service or portfolio page's tagline, description and
// intro from its live copy (/api/admin/draft-copy), copyable for Studio.

import { useState } from "react";
import Select from "@/components/ui/fields/Select";
import Button from "@/components/ui/Button";
import CopyField from "@/components/ui/CopyField";
import FormStatus from "@/components/ui/FormStatus";
import SelectField from "@/components/ui/fields/SelectField";
import { inputClass } from "@/components/ui/fields/Field";
import { useAiAction } from "./useAiAction";

export type CopySubject = {
  kind: "service" | "portfolio";
  slug: string;
  title: string;
};

type Mode = "tighten" | "rewrite" | "fresh";
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
  const { run, status, result: copy, error } = useAiAction<Copy>(
    "/api/admin/draft-copy",
    (json) => (json.drafted ? (json.copy as Copy) : null),
  );

  const services = subjects.filter((s) => s.kind === "service");
  const portfolios = subjects.filter((s) => s.kind === "portfolio");

  async function polish() {
    if (!selected || status === "loading") return;
    const [kind, ...rest] = selected.split(":");
    const slug = rest.join(":");
    await run({ kind, slug, mode, angle: angle.trim() || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cp-subject" className="block text-sm font-medium mb-1.5">
            Page
          </label>
          <Select
            id="cp-subject"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="text-sm"
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
          </Select>
        </div>
        <SelectField
          id="cp-mode"
          label="What to do"
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          options={MODES}
        />
      </div>
      <div>
        <label htmlFor="cp-angle" className="block text-sm font-medium mb-1.5">
          Angle / emphasis{" "}
          <span className="text-muted font-normal">(optional)</span>
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
        <Button
          variant="secondary"
          onClick={polish}
          loading={status === "loading"}
          loadingLabel="Drafting…"
          disabled={!selected}
        >
          Polish copy
        </Button>
        <FormStatus state={status} error={error} />
      </div>

      {copy && (
        <div className="mt-2 space-y-4 rounded-lg border border-border bg-background p-5">
          {copy.tagline && <CopyField label="Tagline" value={copy.tagline} />}
          {copy.description && (
            <CopyField label="Description" value={copy.description} />
          )}
          {copy.intro.length > 0 && (
            <CopyField label="Intro" value={copy.intro.join("\n\n")} />
          )}
          <p className="text-xs text-muted">
            AI draft. Review it, then update the page in Studio. Nothing changes
            on the site until you save it there.
          </p>
        </div>
      )}
    </div>
  );
}
