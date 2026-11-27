"use client";

// Drafts website copy for review in Studio (/api/admin/draft-copy): a new
// journal post from a topic (title, excerpt, tags and body), or a service or
// portfolio page's tagline, description and intro from its live copy. Each
// part is copyable; nothing is published. Changing what to draft clears the
// draft on screen.

import { useState } from "react";
import Link from "next/link";
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
type Post = { title: string; excerpt: string; body: string; tags: string[] };
type Draft = { kind: "journal"; post: Post } | { kind: "page"; copy: Copy };

const input = `${inputClass} text-sm`;

// The "What to draft" value for a new journal post; a page is "<kind>:<slug>".
const JOURNAL = "journal";

const MODES: { value: Mode; label: string }[] = [
  { value: "tighten", label: "Tighten the current copy" },
  { value: "rewrite", label: "Rewrite it fresh" },
  { value: "fresh", label: "Draft from scratch" },
];

const POST_TYPES = [
  { value: "", label: "Any type" },
  { value: "Recap / behind-the-scenes", label: "Recap / behind-the-scenes" },
  { value: "Educational / tips", label: "Educational / tips" },
  { value: "Personal essay", label: "Personal essay" },
  { value: "Seasonal / announcement", label: "Seasonal / announcement" },
];

const studioLink = (
  <Link href="/studio" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-accent">
    Studio
  </Link>
);

export default function CopyDrafter({ subjects }: { subjects: CopySubject[] }) {
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<Mode>("tighten");
  const [angle, setAngle] = useState("");
  const [topic, setTopic] = useState("");
  const [postType, setPostType] = useState("");
  const { run, status, result: draft, error, reset } = useAiAction<Draft>("/api/admin/draft-copy", (json) =>
    !json.drafted
      ? null
      : json.post
        ? { kind: "journal", post: json.post as Post }
        : { kind: "page", copy: json.copy as Copy },
  );

  const journal = selected === JOURNAL;
  const services = subjects.filter((s) => s.kind === "service");
  const portfolios = subjects.filter((s) => s.kind === "portfolio");
  const ready = journal ? !!topic.trim() : !!selected;

  function choose(value: string) {
    setSelected(value);
    reset();
  }

  async function submit() {
    if (!ready || status === "loading") return;
    if (journal) {
      await run({ kind: "journal", topic, postType: postType || undefined });
      return;
    }
    const [kind, ...rest] = selected.split(":");
    await run({ kind, slug: rest.join(":"), mode, angle: angle.trim() || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="cd-subject" className="block text-sm font-medium mb-1.5">
            What to draft
          </label>
          <Select id="cd-subject" value={selected} onChange={(e) => choose(e.target.value)} className="text-sm">
            <option value="">Choose…</option>
            <optgroup label="Journal">
              <option value={JOURNAL}>A new journal post</option>
            </optgroup>
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
        {journal ? (
          <SelectField
            id="cd-type"
            label={
              <>
                Post type <span className="text-muted font-normal">(optional)</span>
              </>
            }
            value={postType}
            onChange={setPostType}
            options={POST_TYPES}
          />
        ) : (
          <SelectField
            id="cd-mode"
            label="What to do"
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={MODES}
          />
        )}
      </div>
      {journal ? (
        <div>
          <label htmlFor="cd-topic" className="block text-sm font-medium mb-1.5">
            Topic or brief
          </label>
          <textarea
            id="cd-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={4}
            placeholder="e.g. Why I shoot weddings documentary-style, and what that means for a couple's day. Or: 5 tips for a relaxed engagement session in the DMV."
            className={input}
          />
        </div>
      ) : (
        <div>
          <label htmlFor="cd-angle" className="block text-sm font-medium mb-1.5">
            Angle / emphasis <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="cd-angle"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="e.g. lean into the documentary style, or emphasize DMV venues"
            className={input}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={submit}
          loading={status === "loading"}
          loadingLabel="Drafting…"
          disabled={!ready}
        >
          {journal ? "Draft post" : "Polish copy"}
        </Button>
        <FormStatus state={status} error={error} />
      </div>

      {draft?.kind === "journal" && (
        <div className="mt-2 space-y-4 rounded-lg border border-border bg-background p-5">
          <CopyField label="Title" value={draft.post.title} />
          {draft.post.excerpt && <CopyField label="Excerpt" value={draft.post.excerpt} />}
          {draft.post.tags.length > 0 && <CopyField label="Tags" value={draft.post.tags.join(", ")} />}
          <CopyField label="Body" value={draft.post.body} />
          <p className="text-xs text-muted">
            AI draft. Review and edit it, then create a new post in {studioLink} and add a cover image and publish
            date there. Nothing is published until you do.
          </p>
        </div>
      )}
      {draft?.kind === "page" && (
        <div className="mt-2 space-y-4 rounded-lg border border-border bg-background p-5">
          {draft.copy.tagline && <CopyField label="Tagline" value={draft.copy.tagline} />}
          {draft.copy.description && <CopyField label="Description" value={draft.copy.description} />}
          {draft.copy.intro.length > 0 && <CopyField label="Intro" value={draft.copy.intro.join("\n\n")} />}
          <p className="text-xs text-muted">
            AI draft. Review it, then update the page in {studioLink}. Nothing changes on the site until you save it
            there.
          </p>
        </div>
      )}
    </div>
  );
}
