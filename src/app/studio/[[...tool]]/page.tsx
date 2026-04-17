// Embedded Sanity Studio — all of Studio's own client-side routing happens
// beneath /studio/..., matched by the optional catch-all [[...tool]].
//
// `force-static` tells Next.js to prerender the shell; Studio itself is
// client-rendered so there's no server work per request.
//
// We re-export `metadata` + `viewport` from next-sanity/studio so the
// Studio tab gets the right <title>, icons, and viewport scaling — our
// site's root layout metadata doesn't suit Studio's full-screen UI.

import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";

export const dynamic = "force-static";
export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  return <NextStudio config={config} />;
}
