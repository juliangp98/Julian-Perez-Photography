"use client";
import AiButton from "@/components/AiButton";

// Draft an SEO meta description for a key static/index page with AI. Calls
// /api/admin/draft-meta and shows the result (copyable, with a character count)
// for Julian to apply to the page's metadata. The AI never publishes.

import { useState } from "react";
import CopyField from "@/components/CopyField";
import { SEO_PAGES } from "@/lib/seo-pages";

type Status = "idle" | "drafting" | "drafted" | "error";

const input =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--foreground)] transition";

export default function MetaDrafter() {
  const [page, setPage] = useState("");
  const [angle, setAngle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [meta, setMeta] = useState<string | null>(null);

  async function draft() {
    if (!page || status === "drafting") return;
    setStatus("drafting");
    try {
      const res = await fetch("/api/admin/draft-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, angle: angle.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.drafted && typeof data.meta === "string") {
        setMeta(data.meta);
        setStatus("drafted");
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("error");
    }
  }

  const overLimit = meta != null && meta.length > 160;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="md-page" className="block text-sm font-medium mb-1.5">
            Page
          </label>
          <select
            id="md-page"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className={input}
          >
            <option value="">Choose a page…</option>
            {SEO_PAGES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="md-angle" className="block text-sm font-medium mb-1.5">
            Emphasis{" "}
            <span className="text-[var(--muted)] font-normal">(optional)</span>
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
        <AiButton
          onClick={draft}
          loading={status === "drafting"}
          loadingLabel="Drafting…"
          disabled={!page}
        >
          Draft meta description
        </AiButton>
        {status === "error" && (
          <span role="alert" className="text-sm text-red-700">
            Couldn&rsquo;t draft — please try again.
          </span>
        )}
      </div>

      {meta && (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
          <CopyField label="Meta description" value={meta} />
          <p
            className={`text-xs ${
              overLimit ? "text-amber-700" : "text-[var(--muted)]"
            }`}
          >
            {meta.length} characters
            {overLimit ? " — over 160; trim before using." : " (aim ≤ 160)."}{" "}
            Paste into the page&rsquo;s metadata (or hand it to your developer).
          </p>
        </div>
      )}
    </div>
  );
}
