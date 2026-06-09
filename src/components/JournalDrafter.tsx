"use client";
import AiButton from "@/components/AiButton";

// Draft a journal post with AI from a topic/brief. Calls /api/admin/draft-journal
// and shows the title, excerpt, tags, and body — each copyable — for Julian to
// paste into a new post in Sanity Studio (where he adds the cover image + date
// and publishes). The AI never publishes; this only drafts the text.

import { useState } from "react";
import Link from "next/link";
import CopyField from "@/components/CopyField";

type Post = {
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
};

type Status = "idle" | "drafting" | "drafted" | "error";

const input =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white text-sm focus:outline-none focus:border-[var(--foreground)] transition";

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
  const [status, setStatus] = useState<Status>("idle");
  const [post, setPost] = useState<Post | null>(null);

  async function draft() {
    if (!topic.trim() || status === "drafting") return;
    setStatus("drafting");
    try {
      const res = await fetch("/api/admin/draft-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          postType: postType || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.drafted && data.post) {
        setPost(data.post as Post);
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
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label htmlFor="jd-type" className="block text-sm font-medium mb-1.5">
            Post type{" "}
            <span className="text-[var(--muted)] font-normal">(optional)</span>
          </label>
          <select
            id="jd-type"
            value={postType}
            onChange={(e) => setPostType(e.target.value)}
            className={input}
          >
            {POST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || "Julian's choice"}
              </option>
            ))}
          </select>
        </div>
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
          placeholder="e.g. Why I shoot weddings documentary-style — and what that means for a couple's day. Or: 5 tips for a relaxed engagement session in the DMV."
          className={input}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AiButton
          onClick={draft}
          loading={status === "drafting"}
          loadingLabel="Drafting…"
          disabled={!topic.trim()}
        >
          Draft post
        </AiButton>
        {status === "error" && (
          <span role="alert" className="text-sm text-red-700">
            Couldn&rsquo;t draft — please try again.
          </span>
        )}
      </div>

      {post && (
        <div className="mt-2 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
          <CopyField label="Title" value={post.title} />
          <CopyField label="Excerpt" value={post.excerpt} />
          {post.tags.length > 0 && (
            <CopyField label="Tags" value={post.tags.join(", ")} />
          )}
          <CopyField label="Body" value={post.body} />
          <p className="text-xs text-[var(--muted)]">
            AI draft — review and edit it, then create a new post in{" "}
            <Link
              href="/studio"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-[var(--accent)]"
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
