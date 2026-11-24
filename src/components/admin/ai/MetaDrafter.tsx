"use client";

// Drafts an SEO meta description for a key page (/api/admin/draft-meta), shown
// copyable with a character count. Nothing is published.

import { useState } from "react";
import Button from "@/components/ui/Button";
import CopyField from "@/components/ui/CopyField";
import FormStatus from "@/components/ui/FormStatus";
import SelectField from "@/components/ui/fields/SelectField";
import { SEO_PAGES } from "@/lib/seo-pages";
import { inputClass } from "@/components/ui/fields/Field";
import { useAiAction } from "./useAiAction";

const input = `${inputClass} text-sm`;

export default function MetaDrafter() {
  const [page, setPage] = useState("");
  const [angle, setAngle] = useState("");
  const { run, status, result: meta, error } = useAiAction<string>(
    "/api/admin/draft-meta",
    (json) => (json.drafted && typeof json.meta === "string" ? json.meta : null),
  );

  async function draft() {
    if (!page || status === "loading") return;
    await run({ page, angle: angle.trim() || undefined });
  }

  const overLimit = meta != null && meta.length > 160;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <SelectField
          id="md-page"
          label="Page"
          value={page}
          onChange={setPage}
          placeholder="Choose a page…"
          clearable
          options={SEO_PAGES.map((p) => ({ value: p.key, label: p.label }))}
        />
        <div>
          <label htmlFor="md-angle" className="block text-sm font-medium mb-1.5">
            Emphasis{" "}
            <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="md-angle"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="e.g. lean into a specific season or service"
            className={input}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={draft}
          loading={status === "loading"}
          loadingLabel="Drafting…"
          disabled={!page}
        >
          Draft meta description
        </Button>
        <FormStatus state={status} error={error} />
      </div>

      {meta && (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-5">
          <CopyField label="Meta description" value={meta} />
          <p className={`text-xs ${overLimit ? "text-danger" : "text-muted"}`}>
            {meta.length} characters
            {overLimit ? ". Over 160; trim before using." : " (aim ≤ 160)."}{" "}
            Paste into the page&rsquo;s metadata (or hand it to your developer).
          </p>
        </div>
      )}
    </div>
  );
}
