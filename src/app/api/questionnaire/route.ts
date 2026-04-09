import { NextResponse } from "next/server";
import { Resend } from "resend";
import { siteSettings, getService } from "@/lib/content";
import {
  getQuestionnaire,
  evaluateShowIf,
  visibleSectionsFor,
} from "@/lib/questionnaires";

type Answers = Record<string, string | string[]>;

export async function POST(req: Request) {
  let body: { service?: string; company?: string; answers?: Answers };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot — silently succeed.
  if (body.company) return NextResponse.json({ ok: true });

  const slug = body.service;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing service" }, { status: 400 });
  }

  const q = getQuestionnaire(slug);
  if (!q) {
    return NextResponse.json({ error: "Unknown questionnaire" }, { status: 400 });
  }

  const answers = body.answers || {};

  // Validate required fields against the schema, mirroring the same showIf
  // logic the form uses. Sections hidden by their own showIf clause are
  // skipped wholesale — fields inside them aren't required and shouldn't be
  // emailed even if a stale draft submitted them.
  const visibleSections = visibleSectionsFor(q, answers);
  for (const section of visibleSections) {
    for (const f of section.fields) {
      if (!f.required) continue;
      if (!evaluateShowIf(f.showIf, answers)) continue;
      const v = answers[f.id];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
        return NextResponse.json(
          { error: `Missing required field: ${f.label}` },
          { status: 400 },
        );
      }
    }
  }

  // Length sanity caps to keep email payloads reasonable.
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === "string" && v.length > 5000) {
      return NextResponse.json(
        { error: `Field ${k} is too long.` },
        { status: 400 },
      );
    }
  }

  const svc = getService(slug);
  const serviceTitle = svc?.title || slug;
  const clientName =
    (typeof answers["fullName"] === "string" && answers["fullName"]) ||
    "Unknown client";
  const clientEmail =
    typeof answers["email"] === "string" ? answers["email"] : undefined;

  // Build a sectioned text email — one section header per questionnaire section.
  const lines: string[] = [];
  lines.push(`New questionnaire — ${q.title}`);
  lines.push(`Service: ${serviceTitle}`);
  lines.push(`Submitted: ${new Date().toISOString()}`);
  lines.push("");

  for (const section of visibleSections) {
    const sectionVisibleFields = section.fields.filter((f) =>
      evaluateShowIf(f.showIf, answers),
    );
    const populatedFields = sectionVisibleFields.filter((f) => {
      const v = answers[f.id];
      return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    });
    if (populatedFields.length === 0) continue;

    lines.push(`── ${section.title.toUpperCase()} ──`);
    for (const f of populatedFields) {
      const v = answers[f.id];
      const display = Array.isArray(v) ? v.join(", ") : String(v);
      lines.push(`${f.label}:`);
      lines.push(`  ${display.split("\n").join("\n  ")}`);
      lines.push("");
    }
  }

  const text = lines.join("\n");
  const subject = `New questionnaire — ${serviceTitle} — ${clientName}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev fallback
    console.log("[questionnaire] RESEND_API_KEY not set — logging instead:");
    console.log(text);
    return NextResponse.json({ ok: true, dev: true });
  }

  const resend = new Resend(apiKey);
  const fromAddress =
    process.env.RESEND_FROM ||
    "Julian Perez Photography <onboarding@resend.dev>";
  const toAddress = process.env.INQUIRY_TO || siteSettings.contactEmail;

  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: toAddress,
      replyTo: clientEmail,
      subject,
      text,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[questionnaire] Resend error:", err);
    return NextResponse.json(
      { error: "Could not send right now. Please email directly." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
