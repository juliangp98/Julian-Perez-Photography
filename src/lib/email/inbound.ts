// Reading mail that arrives through a project's address on the inbound domain:
// reply+<token>@ (a reply in the thread) and log+<token>@ (the owner filing an
// old email from Gmail into the thread). Pure functions, no I/O.

export function inboundDomain(): string | undefined {
  return process.env.RESEND_INBOUND_DOMAIN?.trim() || undefined;
}

export function replyAddress(token: string): string | undefined {
  const domain = inboundDomain();
  return domain ? `reply+${token}@${domain}` : undefined;
}

export function logAddress(token: string): string | undefined {
  const domain = inboundDomain();
  return domain ? `log+${token}@${domain}` : undefined;
}

// "Avery <Avery@Example.com>" → "avery@example.com"
export function addressOf(value: string): string {
  const inBrackets = value.match(/<([^>]+)>/)?.[1];
  return (inBrackets ?? value).trim().toLowerCase();
}

function domainOf(address: string): string {
  return addressOf(address).split("@")[1] ?? "";
}

export function findThreadAddress(
  recipients: string[],
): { mode: "reply" | "log"; token: string } | null {
  const domain = inboundDomain()?.toLowerCase();
  if (!domain) return null;
  for (const r of recipients) {
    const m = addressOf(r).match(/^(reply|log)\+([a-z0-9]+)@(.+)$/);
    if (m && m[3] === domain) return { mode: m[1] as "reply" | "log", token: m[2] };
  }
  return null;
}

export function header(headers: Record<string, string> | null | undefined, name: string): string {
  if (!headers) return "";
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? String(headers[key]) : "";
}

// Out-of-office replies, bounces and list mail: recorded, never forwarded.
export function isAutomated(headers: Record<string, string> | null | undefined): boolean {
  const auto = header(headers, "auto-submitted").toLowerCase();
  if (auto && auto !== "no") return true;
  if (/^(bulk|junk|list|auto_reply)$/i.test(header(headers, "precedence").trim())) return true;
  return !!(header(headers, "x-autoreply") || header(headers, "x-autorespond"));
}

// Whether the receiving server saw a DKIM signature from the sender's own
// domain pass. Required before a message claiming to be from the owner is
// relayed to a client, so the owner's address can't be spoofed into a thread.
export function senderAuthenticated(
  headers: Record<string, string> | null | undefined,
  from: string,
): boolean {
  const results = header(headers, "authentication-results").toLowerCase();
  const domain = domainOf(from);
  if (!results || !domain) return false;
  return results
    .split(";")
    .some((part) => /\bdkim=pass\b/.test(part) && new RegExp(`header\\.[di]=@?${domain.replace(/\./g, "\\.")}\\b`).test(part));
}

// The new part of a reply, without the quoted history mail apps append.
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (line, i) =>
      /^On .+wrote:\s*$/.test(line) ||
      // Gmail wraps a long "On …, Name <addr> wrote:" over two lines.
      (/^On .+/.test(line) && /wrote:\s*$/.test(lines[i + 1] ?? "")) ||
      /^-{2,}\s*Original Message\s*-{2,}/i.test(line) ||
      /^-{5,}\s*Forwarded message/i.test(line) ||
      /^From: .+/.test(line) && /^(Sent|Date): /.test(lines[i + 1] ?? ""),
  );
  const kept = cut === -1 ? lines : lines.slice(0, cut);
  while (kept.length && /^\s*(>.*)?$/.test(kept[kept.length - 1])) kept.pop();
  return kept.join("\n").trim();
}

export type ForwardedMessage = { from: string; date?: string; subject?: string; body: string };

// Gmail's forward format, one block per forwarded message:
//   ---------- Forwarded message ---------
//   From: Avery <avery@example.com>
//   Date: Mon, Nov 17, 2026 at 3:04 PM
//   Subject: Re: Your wedding
//   To: <julian@example.com>
//   (blank line, then the body)
export function parseForwarded(text: string): ForwardedMessage[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/^-{5,}\s*Forwarded message\s*-{5,}\s*$/im).slice(1);
  return blocks.flatMap((block) => {
    const [head, ...rest] = block.replace(/^\n+/, "").split(/\n\s*\n/);
    const field = (name: string) => head.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim();
    const from = field("From");
    if (!from) return [];
    const date = field("Date")?.replace(/\s+at\s+/i, " ");
    const parsed = date ? new Date(date) : null;
    return [
      {
        from,
        date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined,
        subject: field("Subject"),
        body: stripQuoted(rest.join("\n\n")),
      },
    ];
  });
}
