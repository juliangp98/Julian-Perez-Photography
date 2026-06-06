import type { Metadata } from "next";
import Link from "next/link";
import PortalLoginForm from "@/components/PortalLoginForm";

// Portal login (public). Authenticated portal pages live under /portal/* and
// are gated by the proxy. noindex — this is a private surface.
export const metadata: Metadata = {
  title: "Client portal",
  description: "Sign in to your Julian Perez Photography client portal.",
  robots: { index: false, follow: false },
};

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error } = await searchParams;
  const errorMsg =
    error === "invalid-link"
      ? "That sign-in link is invalid or has expired. Request a fresh one below."
      : error === "missing-link"
        ? "That link was incomplete. Request a fresh one below."
        : null;

  return (
    <section className="max-w-md mx-auto px-6 py-24">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Client portal
      </div>
      <h1 className="mt-2 font-serif text-4xl">Sign in</h1>
      <p className="mt-4 text-[var(--muted)] leading-relaxed">
        Enter the email you used with me and I&rsquo;ll send you a secure
        sign-in link — no password needed.
      </p>
      {errorMsg && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {errorMsg}
        </p>
      )}
      <div className="mt-8">
        <PortalLoginForm />
      </div>
      <p className="mt-6 text-sm text-[var(--muted)]">
        New here, or no project yet?{" "}
        <Link
          href="/inquire"
          className="underline underline-offset-4 hover:text-[var(--foreground)]"
        >
          Start with an inquiry →
        </Link>
      </p>
    </section>
  );
}
