import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull, getProjectForEmail } from "@/lib/clients";
import { clientViewProps } from "@/lib/portal-view";
import SubNav, { ADMIN_TABS } from "@/components/ui/SubNav";
import PortalProjectView from "@/components/portal/PortalProjectView";

// "View as client": the project as its client sees it in the portal, from the
// same projection and the same view, read-only, with a banner. Owner-only.
export const metadata: Metadata = {
  title: "View as client · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminViewAsClientPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) redirect("/admin");
  const { id } = await params;
  const full = await getClientFull(id);
  // The client's own read of the project, as the portal makes it.
  const record = full?.email ? await getProjectForEmail(id, full.email) : null;

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={ADMIN_TABS} logoutAction="/admin/logout" />
      <Link
        href={`/admin/projects/${id}`}
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground"
      >
        ← Back to the project
      </Link>
      {record ? (
        <PortalProjectView {...await clientViewProps(record, "owner")} preview />
      ) : (
        <p className="mt-8 rounded-lg border border-dashed border-border p-8 text-muted">
          {full ? "This project has no client email, so there is no client page to show." : "That project couldn’t be found."}
        </p>
      )}
    </section>
  );
}
