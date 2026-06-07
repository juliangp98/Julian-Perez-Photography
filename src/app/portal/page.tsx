import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PortalLoginForm from "@/components/PortalLoginForm";
import CalloutCard from "@/components/CalloutCard";
import SubNav, { CLIENT_TABS } from "@/components/SubNav";
import { getSession } from "@/lib/auth-cookies";

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
  // A signed-in visitor lands on their dashboard rather than the sign-in form,
  // so the "Client portal" tab resolves correctly from both states.
  const session = await getSession();
  if (session) redirect("/portal/dashboard");

  const { error } = await searchParams;
  const errorMsg =
    error === "invalid-link"
      ? "That sign-in link is invalid or has expired. Request a fresh one below."
      : error === "missing-link"
        ? "That link was incomplete. Request a fresh one below."
        : null;

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <SubNav items={CLIENT_TABS} />
      <div className="mx-auto mt-8 max-w-4xl lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
        <div>
          <h1 className="font-serif text-4xl">Sign in</h1>
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
        </div>
        <aside className="mt-10 lg:mt-0 lg:sticky lg:top-24">
          <CalloutCard
            tone="neutral"
            eyebrow="New here, or no project yet?"
            title="Start with an inquiry"
            description="Your portal opens once you have a project with me. New to the studio? Send an inquiry and I'll get you started."
            actions={[{ label: "Start an inquiry →", href: "/inquire" }]}
          />
        </aside>
      </div>
    </section>
  );
}
