// Studio owns the full viewport — the site's Nav/Footer are hidden on
// /studio routes via `usePathname()` gates inside those components (see
// src/components/{Nav,Footer}.tsx). This layout is just a passthrough so
// children render bare, plus a spot to re-export Studio's metadata +
// viewport so the browser tab gets Studio's title + viewport scaling
// rather than the marketing site defaults.
//
// `metadata` must live here, not in page.tsx, because page.tsx is a client
// component (NextStudio requires client context) and client components
// cannot export route metadata. Splitting across layout+page is the
// canonical next-sanity/studio pattern for App Router.

export { metadata, viewport } from "next-sanity/studio";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
