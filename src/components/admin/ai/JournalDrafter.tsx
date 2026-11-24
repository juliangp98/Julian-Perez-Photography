"use client";

// Drafts a journal post from a topic (/api/admin/draft-journal): title, excerpt,
// tags and body, each copyable into a new post in Studio. Nothing is published.

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import CopyField from "@/components/ui/CopyField";
import FormStatus from "@/components/ui/FormStatus";
import SelectField from "@/components/ui/fields/SelectField";
import { inputClass } from "@/components/ui/fields/Field";
import { useAiAction } from "./useAiAction";

type Post = {
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
};

const input = `${inputClass} text-sm`;

const POST_TYPES = [
  "",
  "Recap / behind-the-scenes",
  "Educational / tips",
  "Personal essay",
  "Seasonal / announcement",
];

export default function JournalDrafter() {
  const [topic, setTopic] = useState("");
  const [postType, setPostType] = useState("");
  const { run, status, result: post, error } = useAiAction<Post>(
    "/api/admin/draft-journal",
    (json) => (json.drafted ? (json.post as Post) : null),
  );

  async function draft() {
    if (!topic.trim() || status === "loading") return;
    await run({ topic, postType: postType || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <SelectField
          id="jd-type"
          label={
            <>
              Post type{" "}
              <span className="text-muted font-normal">(optional)</span>
            </>
          }
          value={postType}
          onChange={setPostType}
          options={POST_TYPES.map((t) => ({ value: t, label: t || "Julian's choice" }))}
        />
      </div>
      <div>
        <label htmlFor="jd-topic" className="block text-sm font-medium mb-1.5">
          Topic / brief
        </label>
        <textarea
          id="jd-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={4}
          placeholder="e.g. Why I shoot weddings documentary-style, and what that means for a couple's day. Or: 5 tips for a relaxed engagement session in the DMV."
          className={input}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={draft}
          loading={status === "loading"}
          loadingLabel="Drafting…"
          disabled={!topic.trim()}
        >
          Draft post
        </Button>
        <FormStatus state={status} error={error} />
      </div>

      {post && (
        <div className="mt-2 space-y-4 rounded-lg border border-border bg-background p-5">
          <CopyField label="Title" value={post.title} />
          <CopyField label="Excerpt" value={post.excerpt} />
          {post.tags.length > 0 && (
            <CopyField label="Tags" value={post.tags.join(", ")} />
          )}
          <CopyField label="Body" value={post.body} />
          <p className="text-xs text-muted">
            AI draft. Review and edit it, then create a new post in{" "}
            <Link
              href="/studio"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-accent"
            >
              Studio
            </Link>{" "}
            (add a cover image + publish date there). Nothing is published until
            you do.
          </p>
        </div>
      )}
    </div>
  );
}
