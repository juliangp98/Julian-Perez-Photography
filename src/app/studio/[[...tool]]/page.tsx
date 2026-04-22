// Embedded Sanity Studio — all of Studio's own client-side routing happens
// beneath /studio/..., matched by the optional catch-all [[...tool]].
//
// Must be a client component: Studio is React-only + uses Context APIs that
// don't exist in the server environment. `metadata` / `viewport` come from
// the sibling layout.tsx (server component) since client components can't
// export those. The layout is what makes the Studio tab have the right
// <title> and viewport scaling instead of inheriting the site defaults.
//
// The route is intentionally left publicly reachable. Sanity's own SSO
// gates the content: an unauthenticated visitor sees the Studio shell and
// a login prompt, nothing more. Wrapping the path in Vercel Authentication
// would block Julian from reaching Studio on any browser he hasn't paired
// with the Vercel team, which is worse than the "anyone can see the login
// screen" baseline. `robots.ts` disallows the path so it stays out of
// search indexes.

"use client";

import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";

export default function StudioPage() {
  return <NextStudio config={config} />;
}
