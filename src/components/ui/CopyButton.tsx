"use client";

import { useState } from "react";
import { buttonClass } from "./Button";

// A small "Copy" action that says "Copied" for a moment after it works.
// `what` names the thing copied for screen readers ("Copy Title"), so a page
// of Copy buttons doesn't read as the same button over and over.
export default function CopyButton({
  text,
  label = "Copy",
  what,
}: {
  text: string;
  label?: string;
  what?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (an insecure context); nothing to do.
    }
  }
  return (
    <button type="button" onClick={copy} className={`shrink-0 ${buttonClass("text")}`}>
      {copied ? "Copied" : label}
      {what && <span className="sr-only"> {what}</span>}
    </button>
  );
}
