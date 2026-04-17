// Embedded Sanity Studio config — surfaces the Studio at /studio.
//
// For round 1 (journal activation) we register ONLY the `journalPost` schema.
// The other schemas that live in sanity/schemas/ (siteSettings, serviceCategory,
// portfolioCategory, aboutPage) are written but not wired to rendering yet;
// exposing them here would invite Julian to edit content that wouldn't show
// up on the site. They get turned on in round 14 when their renderers ship.

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { journalPost } from "./sanity/schemas/journalPost";

export default defineConfig({
  name: "julian-perez-photography",
  title: "Julian Perez Photography",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  basePath: "/studio",
  plugins: [structureTool(), visionTool()],
  schema: { types: [journalPost] },
});
