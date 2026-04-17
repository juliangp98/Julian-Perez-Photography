// Studio owns the full viewport — bypass the site's Nav/Footer from the
// root layout by returning children bare. The root layout still wraps this
// (so <html>/<body> come from there), but the in-page chrome is skipped.

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
