import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { siteSettings, getService } from "@/lib/content";

const schema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional().or(z.literal("")),
  service: z.string().min(1),
  eventDate: z.string().optional().or(z.literal("")),
  location: z.string().max(300).optional().or(z.literal("")),
  budget: z.string().max(100).optional().or(z.literal("")),
  referral: z.string().max(200).optional().or(z.literal("")),
  message: z.string().min(1).max(5000),
  // Honeypot — should be empty
  company: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Honeypot triggered — pretend success silently
  if (data.company) {
    return NextResponse.json({ ok: true });
  }

  const serviceName = getService(data.service)?.title || data.service;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev-mode fallback: log to console so you can iterate without Resend set up.
    console.log("[inquire] RESEND_API_KEY not set — logging inquiry instead:");
    console.log({ ...data, serviceName });
    return NextResponse.json({ ok: true, dev: true });
  }

  const resend = new Resend(apiKey);
  const fromAddress =
    process.env.RESEND_FROM || "Julian Perez Photography <onboarding@resend.dev>";
  const toAddress = process.env.INQUIRY_TO || siteSettings.contactEmail;

  const subject = `New inquiry — ${serviceName} — ${data.name}`;
  const text = [
    `New inquiry from ${siteSettings.siteName}`,
    ``,
    `Name:      ${data.name}`,
    `Email:     ${data.email}`,
    `Phone:     ${data.phone || "—"}`,
    `Service:   ${serviceName}`,
    `Date:      ${data.eventDate || "—"}`,
    `Location:  ${data.location || "—"}`,
    `Budget:    ${data.budget || "—"}`,
    `Referral:  ${data.referral || "—"}`,
    ``,
    `Message:`,
    data.message,
  ].join("\n");

  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: toAddress,
      replyTo: data.email,
      subject,
      text,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[inquire] Resend error:", err);
    return NextResponse.json(
      { error: "Could not send right now. Please email directly." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
