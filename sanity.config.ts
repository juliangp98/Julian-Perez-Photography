// Embedded Sanity Studio config — surfaces the Studio at /studio.
//
// All schemas below are live in Studio: journalPost, siteSettings
// (singleton), categoryUmbrella + serviceCategory (+ pkg/addOn inline
// objects), portfolioCategory (metadata-only — binaries stay in
// /public), and aboutPage (singleton). The full content graph is in
// Studio; webhook revalidation wires publish → site propagation.
//
// Client records (the CRM) are NOT in Sanity — they hold PII, which needs a
// private dataset (a Sanity paid feature). The client store is a free, private
// Postgres table instead (see src/lib/clients.ts), managed via the Supabase
// Table Editor.

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
import {
  portfolioCategory,
  videoEntry,
} from "./sanity/schemas/portfolioCategory";
import { aboutPage } from "./sanity/schemas/aboutPage";

// Singleton types: exactly one document of this type should exist in the
// dataset. Pinned above the divider in the rail; `document.actions` +
// `document.newDocumentOptions` below strip duplicate/delete so editors
// can't fork or nuke the seeded doc.
const SINGLETON_TYPES = new Set(["siteSettings", "aboutPage"]);

// Locked-set types: fixed number of docs where the set is code-controlled
// (e.g. categoryUmbrella mirrors the `Umbrella` union in src/lib/types.ts).
const LOCKED_SET_TYPES = new Set(["categoryUmbrella"]);

const PROTECTED_TYPES = new Set([...SINGLETON_TYPES, ...LOCKED_SET_TYPES]);

const SINGLETON_IDS: Record<string, string> = {
  siteSettings: "siteSettings",
  aboutPage: "aboutPage",
};

// Fail loud when the project id is missing instead of silently booting Studio
// against an empty project.
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
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.listItem()
              .title("Site Settings")
              .id("siteSettings")
              .child(
                S.document()
                  .schemaType("siteSettings")
                  .documentId(SINGLETON_IDS.siteSettings),
              ),
            S.listItem()
              .title("About Page")
              .id("aboutPage")
              .child(
                S.document()
                  .schemaType("aboutPage")
                  .documentId(SINGLETON_IDS.aboutPage),
              ),
            S.divider(),
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
      videoEntry,
      aboutPage,
    ],
  },
  document: {
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === "global"
        ? prev.filter((item) => !PROTECTED_TYPES.has(item.templateId))
        : prev,
    actions: (prev, { schemaType }) =>
      PROTECTED_TYPES.has(schemaType)
        ? prev.filter(
            (action) =>
              !["duplicate", "delete", "unpublish"].includes(
                action.action ?? "",
              ),
          )
        : prev,
  },
});
