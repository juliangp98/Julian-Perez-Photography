"use client";

// Reusable concierge chat core — a grounded, multi-turn Q&A against
// /api/concierge. Used two ways: inside the floating ConciergeWidget popover
// (variant "panel") and docked on the /faq page (variant "docked"). It holds
// only the real transcript in state (the greeting is presentational) and posts
// the bounded conversation on each turn.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

const STARTERS = [
  "How much is wedding photography?",
  "What's included in a session?",
  "How do I book?",
];

const GREETING =
  "Hi there! I can help with questions about services, pricing, and booking. What are you planning?";

const ERROR_REPLY =
  "Sorry — I couldn't answer just now. Please try again, or send an inquiry and Julian will follow up.";

export type ConciergeChatProps = {
  inquireHref?: string;
  faqHref?: string;
  variant?: "panel" | "docked";
};

export default function ConciergeChat({
  inquireHref = "/inquire",
  faqHref,
  variant = "panel",
}: ConciergeChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const logRef = useRef<HTMLDivElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Keep the transcript pinned to the latest turn by scrolling the log
    // container itself — never the page. Skip the initial empty state so the
    // docked /faq variant doesn't yank the viewport down to the chat on load.
    if (messages.length === 0) return;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  async function request(convo: Msg[]) {
    setStatus("sending");
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: convo.slice(-8),
          hp_company: hpRef.current?.value || "",
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const reply =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : ERROR_REPLY;
      setMessages([...convo, { role: "assistant", content: reply }]);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || status === "sending") return;
    const convo: Msg[] = [...messages, { role: "user", content }];
    setMessages(convo);
    setInput("");
    void request(convo);
  }

  function retry() {
    if (status === "sending") return;
    if (messages[messages.length - 1]?.role === "user") void request(messages);
  }

  const rootHeight = variant === "docked" ? "h-[28rem]" : "h-full";

  return (
    <div className={`flex flex-col ${rootHeight} min-h-0`}>
      {/* Conversation */}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation with the booking assistant"
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3"
      >
        <Bubble role="assistant">{GREETING}</Bubble>

        {messages.length === 0 && (
          <div className="pt-1">
            <p className="text-xs text-[var(--muted)] mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-xs rounded-full border border-[var(--border)] px-3 py-1.5 text-left hover:border-[var(--foreground)] transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.content}
          </Bubble>
        ))}

        {status === "sending" && (
          <Bubble role="assistant">
            <span className="inline-flex gap-1 items-center text-[var(--muted)]">
              <Dot /> <Dot /> <Dot />
              <span className="sr-only">Thinking…</span>
            </span>
          </Bubble>
        )}

        {status === "error" && (
          <div role="alert" className="text-xs text-red-700 flex items-center gap-2">
            Something went wrong.
            <button
              type="button"
              onClick={retry}
              className="underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-[var(--border)] p-3"
      >
        {/* Honeypot — visually hidden; real visitors never fill it. */}
        <input
          ref={hpRef}
          type="text"
          name="hp_company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        <div className="flex items-end gap-2">
          <label htmlFor={`cc-input-${variant}`} className="sr-only">
            Ask a question
          </label>
          <textarea
            id={`cc-input-${variant}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={800}
            placeholder="Ask about services, pricing, or booking…"
            className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)] transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || status === "sending"}
            className="shrink-0 rounded-lg bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-sm hover:opacity-90 transition disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
          AI assistant — answers may be imperfect; confirm details by{" "}
          <Link href={inquireHref} className="underline underline-offset-2">
            sending an inquiry
          </Link>
          {faqHref ? (
            <>
              {" "}
              or browsing the{" "}
              <Link href={faqHref} className="underline underline-offset-2">
                FAQ
              </Link>
            </>
          ) : null}
          .
        </p>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: Role; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--foreground)] text-[var(--background)] px-3.5 py-2 text-sm whitespace-pre-line"
            : "max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 text-sm whitespace-pre-line"
        }
      >
        {children}
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
  );
}
