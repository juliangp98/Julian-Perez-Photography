import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth-cookies";
import PortalLoginForm from "@/components/portal/PortalLoginForm";

// Admin login (public). The authenticated admin area lives under /admin/* and
// is gated by the proxy + the ADMIN_EMAIL allowlist. noindex.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in → straight to the dashboard.
  if (await getAdminSession()) redirect("/admin/projects");

  const { error } = await searchParams;
  const errorMsg =
    error === "invalid-link"
      ? "That sign-in link is invalid or has expired. Request a fresh one below."
      : error === "missing-link"
        ? "That link was incomplete. Request a fresh one below."
        : null;

  return (
    <section className="max-w-md mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Admin
      </div>
      <h1 className="mt-2 font-serif text-4xl">Owner sign-in</h1>
      <p className="mt-4 text-[var(--muted)] leading-relaxed">
        Enter your owner email and I&rsquo;ll send a secure sign-in link.
      </p>
      {errorMsg && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {errorMsg}
        </p>
      )}
      <div className="mt-8">
        <PortalLoginForm
          endpoint="/api/admin/request-link"
          sentMessage="If that email is authorized, a sign-in link is on its way. It expires in 20 minutes."
        />
      </div>
    </section>
  );
}
