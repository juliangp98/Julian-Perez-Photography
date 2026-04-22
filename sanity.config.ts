// Embedded Sanity Studio config — surfaces the Studio at /studio.
//
// All schemas below are live in Studio: journalPost, siteSettings
// (singleton), categoryUmbrella + serviceCategory (+ pkg/addOn inline
// objects), portfolioCategory (metadata-only — binaries stay in
// /public), and aboutPage (singleton). The full content graph is in
// Studio; webhook revalidation wires publish → site propagation.

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { journalPost } from "./sanity/schemas/journalPost";
import { siteSettings } from "./sanity/schemas/siteSettings";
import { categoryUmbrella } from "./sanity/schemas/categoryUmbrella";
import {
  serviceCategory,
  pkg,
  addOn,
} from "./sanity/schemas/serviceCategory";
import { portfolioCategory } from "./sanity/schemas/portfolioCategory";
import { aboutPage } from "./sanity/schemas/aboutPage";

// Singleton types: exactly one document of this type should exist in the
// dataset. Pinned above the divider in the rail; `document.actions` +
// `document.newDocumentOptions` below strip duplicate/delete so editors
// can't fork or nuke the seeded doc.
const SINGLETON_TYPES = new Set(["siteSettings", "aboutPage"]);

// Locked-set types: fixed number of docs where the set is code-controlled
// (e.g. categoryUmbrella mirrors the `Umbrella` union in src/lib/types.ts).
// Editors can edit values but can't add or remove docs. Listed in the
// rail normally (all 4 umbrellas stay visible); create/delete hidden
// below.
const LOCKED_SET_TYPES = new Set(["categoryUmbrella"]);

// Union — both singletons and locked-sets get `+ New` hidden from the
// global menu and duplicate/delete/unpublish stripped from the doc pane.
const PROTECTED_TYPES = new Set([...SINGLETON_TYPES, ...LOCKED_SET_TYPES]);

// Fixed document IDs for singletons — kept in lockstep with the seed
// script (`scripts/seed-sanity.ts`) so re-seeding always targets the same
// doc. Locked-set ids are also stable but encoded in the seed script
// (umbrella-<id> per umbrella in types.ts) rather than listed here.
const SINGLETON_IDS: Record<string, string> = {
  siteSettings: "siteSettings",
  aboutPage: "aboutPage",
};

// Fail loud when the project id is missing instead of silently booting
// Studio against an empty project. A blank id produces cryptic runtime
// errors inside Studio (tokens mint, queries run, nothing ever comes
// back) — a thrown error at module load surfaces the real problem.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
if (!projectId) {
  throw new Error(
    "NEXT_PUBLIC_SANITY_PROJECT_ID is required. " +
      "Run `vercel env pull` or set it in .env.local.",
  );
}

export default defineConfig({
  name: "julian-perez-photography",
  title: "Julian Perez Photography",
  projectId,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  basePath: "/studio",
  plugins: [
    structureTool({
      // Custom rail:
      //   ─ Site Settings (singleton, pinned at top)
      //   ─ About Page    (singleton)
      //   ─ (divider)
      //   ─ Services (ordered by `order`)
      //   ─ Portfolios (ordered by `order`)
      //   ─ Umbrellas (locked set of 4, ordered by `order`)
      //   ─ (divider)
      //   ─ everything else (currently: Journal Post) — auto-listed so
      //     future doc types appear without a rail edit.
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            // Singleton: Site Settings
            S.listItem()
              .title("Site Settings")
              .id("siteSettings")
              .child(
                S.document()
                  .schemaType("siteSettings")
                  .documentId(SINGLETON_IDS.siteSettings),
              ),
            // Singleton: About Page
            S.listItem()
              .title("About Page")
              .id("aboutPage")
              .child(
                S.document()
                  .schemaType("aboutPage")
                  .documentId(SINGLETON_IDS.aboutPage),
              ),
            S.divider(),
            // Services + Umbrellas — explicit list items so the rail
            // pins their ordering (lowest `order` first) rather than
            // accepting the default alphabetical sort.
            S.listItem()
              .title("Services")
              .id("serviceCategory")
              .child(
                S.documentTypeList("serviceCategory")
                  .title("Services")
                  .defaultOrdering([{ field: "order", direction: "asc" }]),
              ),
            S.listItem()
              .title("Portfolios")
              .id("portfolioCategory")
              .child(
                S.documentTypeList("portfolioCategory")
                  .title("Portfolios")
                  .defaultOrdering([{ field: "order", direction: "asc" }]),
              ),
            S.listItem()
              .title("Umbrellas")
              .id("categoryUmbrella")
              .child(
                S.documentTypeList("categoryUmbrella")
                  .title("Umbrellas")
                  .defaultOrdering([{ field: "order", direction: "asc" }]),
              ),
            S.divider(),
            // Auto-listed catalog for everything else (currently just
            // journalPost). Filter out the explicitly-listed types above
            // and the singletons to avoid double-rendering them.
            ...S.documentTypeListItems().filter((item) => {
              const id = item.getId() ?? "";
              return (
                !SINGLETON_TYPES.has(id) &&
                id !== "serviceCategory" &&
                id !== "portfolioCategory" &&
                id !== "categoryUmbrella"
              );
            }),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: [
      journalPost,
      siteSettings,
      categoryUmbrella,
      serviceCategory,
      pkg,
      addOn,
      portfolioCategory,
      aboutPage,
    ],
  },
  document: {
    // Hide "New <protected type>" from the global "+" menu — for
    // singletons the seeded doc is the only one; for locked sets the
    // code-controlled set is definitive.
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === "global"
        ? prev.filter((item) => !PROTECTED_TYPES.has(item.templateId))
        : prev,
    // Strip duplicate/delete/unpublish for protected types. Editors can
    // still publish and discard draft changes, which is the intended
    // surface for these docs.
    actions: (prev, { schemaType }) =>
      PROTECTED_TYPES.has(schemaType)
        ? prev.filter(
            (action) =>
              !["duplicate", "delete", "unpublish"].includes(action.action ?? ""),
          )
        : prev,
  },
});
