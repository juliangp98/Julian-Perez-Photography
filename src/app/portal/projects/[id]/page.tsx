import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-cookies";
import { getProjectForViewer } from "@/lib/clients";
import { clientViewProps } from "@/lib/portal-view";
import SubNav, { CLIENT_TABS } from "@/components/ui/SubNav";
import PortalProjectView from "@/components/portal/PortalProjectView";

// One project view: the client-safe projection (or a second photographer's
// narrower one), plus the stage facts listStageFacts lets out, gated to the
// signed-in person's email (getProjectForViewer), so a client can never open a
// project id that isn't theirs.
export const metadata: Metadata = {
  title: "Your project",
  robots: { index: false, follow: false },
};

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/portal");
  const { id } = await params;
  const viewer = await getProjectForViewer(id, session.email);

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={CLIENT_TABS} logoutAction="/portal/logout" />
      <Link
        href="/portal/dashboard"
        className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground"
      >
        ← Your projects
      </Link>
      {viewer ? (
        <PortalProjectView {...await clientViewProps(viewer.record, viewer.viewerRole)} />
      ) : (
        <>
          <h1 className="mt-4 font-serif text-3xl">Project not found</h1>
          <p className="mt-3 text-muted">
            That project isn&rsquo;t on your account. Head back to your projects.
          </p>
        </>
      )}
    </section>
  );
}
