"use client";

import { useState } from "react";
import { buttonClass } from "./Button";

// A small "Copy" action that says "Copied" for a moment after it works.
export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
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
    </button>
  );
}
