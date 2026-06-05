"use client";

// Generate + review + persist accessibility alt text for portfolio gallery
// images. Pick a gallery, optionally "Generate all", edit any line, and Save —
// each Save persists an override (via /api/admin/save-alt) that overlays the
// manifest baseline at render and survives photo re-imports. Generation
// (/api/admin/draft-alt) uses the vision model, one image at a time.

import { useState } from "react";
import Image from "next/image";

type Img = { src: string; alt: string };
export type AltGallery = { slug: string; title: string; images: Img[] };

type RowStatus = "idle" | "generating" | "saving" | "saved" | "error";
type Row = { alt: string; status: RowStatus };

const input =
  "w-full px-3 py-2 rounded border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--foreground)] transition";

export default function AltDrafter({ galleries }: { galleries: AltGallery[] }) {
  const [slug, setSlug] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [bulk, setBulk] = useState(false);

  const gallery = galleries.find((g) => g.slug === slug);

  function selectGallery(s: string) {
    setSlug(s);
    const g = galleries.find((x) => x.slug === s);
    const init: Record<string, Row> = {};
    for (const img of g?.images ?? []) {
      init[img.src] = { alt: img.alt, status: "idle" };
    }
    setRows(init);
  }

  function patch(src: string, p: Partial<Row>) {
    setRows((prev) => ({ ...prev, [src]: { ...prev[src], ...p } }));
  }

  async function generate(src: string) {
    patch(src, { status: "generating" });
    try {
      const res = await fetch("/api/admin/draft-alt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, src }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.drafted && data.alt) patch(src, { alt: data.alt, status: "idle" });
      else patch(src, { status: "idle" });
    } catch {
      patch(src, { status: "error" });
    }
  }

  async function save(src: string) {
    const alt = rows[src]?.alt?.trim();
    if (!alt) return;
    patch(src, { status: "saving" });
    try {
      const res = await fetch("/api/admin/save-alt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src, alt }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      patch(src, { status: data.saved ? "saved" : "idle" });
    } catch {
      patch(src, { status: "error" });
    }
  }

  async function generateAll() {
    if (!gallery) return;
    setBulk(true);
    for (const img of gallery.images) {
      await generate(img.src);
    }
    setBulk(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label htmlFor="al-gallery" className="block text-sm font-medium mb-1.5">
            Gallery
          </label>
          <select
            id="al-gallery"
            value={slug}
            onChange={(e) => selectGallery(e.target.value)}
            className={`${input} px-4 py-3`}
          >
            <option value="">Choose a gallery…</option>
            {galleries.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title} ({g.images.length})
              </option>
            ))}
          </select>
        </div>
        {gallery && gallery.images.length > 0 && (
          <button
            type="button"
            onClick={generateAll}
            disabled={bulk}
            className="px-5 py-3 text-sm rounded-full border border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition disabled:opacity-50"
          >
            {bulk ? "Generating…" : "✨ Generate all"}
          </button>
        )}
      </div>

      {gallery && gallery.images.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          No images imported into this gallery yet.
        </p>
      )}

      {gallery && gallery.images.length > 0 && (
        <ul className="space-y-3">
          {gallery.images.map((img) => {
            const row = rows[img.src] ?? { alt: img.alt, status: "idle" };
            return (
              <li
                key={img.src}
                className="flex flex-wrap items-start gap-3 rounded-lg border border-[var(--border)] bg-white p-3"
              >
                <Image
                  src={img.src}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0 rounded object-cover"
                />
                <div className="flex-1 min-w-[14rem] space-y-2">
                  <textarea
                    value={row.alt}
                    onChange={(e) => patch(img.src, { alt: e.target.value })}
                    rows={2}
                    aria-label={`Alt text for ${img.src}`}
                    className={input}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => generate(img.src)}
                      disabled={row.status === "generating" || bulk}
                      className="text-xs rounded-full border border-[var(--foreground)] px-3 py-1 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition disabled:opacity-50"
                    >
                      {row.status === "generating" ? "Generating…" : "✨ Generate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => save(img.src)}
                      disabled={row.status === "saving" || !row.alt.trim()}
                      className="text-xs rounded-full bg-[var(--foreground)] text-[var(--background)] px-3 py-1 hover:opacity-90 transition disabled:opacity-50"
                    >
                      {row.status === "saving" ? "Saving…" : "Save"}
                    </button>
                    {row.status === "saved" && (
                      <span className="text-xs text-[var(--muted)]">Saved ✓</span>
                    )}
                    {row.status === "error" && (
                      <span role="alert" className="text-xs text-red-700">
                        Something went wrong.
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
