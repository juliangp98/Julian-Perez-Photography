"use client";

// Drafts, reviews and saves alt text for a portfolio gallery's images. Generate
// uses the vision model (/api/admin/draft-alt) one image at a time; Save stores
// an override (/api/admin/save-alt) that wins over the image's own alt.

import { useState } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import FormStatus from "@/components/ui/FormStatus";
import SelectField from "@/components/ui/fields/SelectField";

type Img = { src: string; alt: string };
export type AltGallery = { slug: string; title: string; images: Img[] };

type RowStatus = "idle" | "generating" | "saving" | "saved" | "error";
type Row = { alt: string; status: RowStatus };

const input =
  "w-full px-3 py-2 rounded border border-border bg-white text-sm focus:outline-none focus:border-foreground transition";

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
        <SelectField
          id="al-gallery"
          label="Gallery"
          value={slug}
          onChange={selectGallery}
          placeholder="Choose a gallery…"
          clearable
          options={galleries.map((g) => ({
            value: g.slug,
            label: `${g.title} (${g.images.length})`,
          }))}
        />
        {gallery && gallery.images.length > 0 && (
          <Button
            variant="secondary"
            onClick={generateAll}
            loading={bulk}
            loadingLabel="Generating…"
          >
            Generate all
          </Button>
        )}
      </div>

      {gallery && gallery.images.length === 0 && (
        <p className="text-sm text-muted">
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
                className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-white p-3"
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => generate(img.src)}
                      loading={row.status === "generating"}
                      loadingLabel="Generating…"
                      disabled={bulk}
                    >
                      Generate
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => save(img.src)}
                      loading={row.status === "saving"}
                      loadingLabel="Saving…"
                      disabled={!row.alt.trim()}
                    >
                      Save
                    </Button>
                    <FormStatus
                      state={row.status === "saved" ? "ok" : row.status}
                      ok="Saved."
                      error="Something went wrong."
                    />
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
