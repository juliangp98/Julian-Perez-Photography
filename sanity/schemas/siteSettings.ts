import { defineField, defineType } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({ name: "siteName", type: "string", validation: (r) => r.required() }),
    defineField({ name: "tagline", type: "string" }),
    defineField({ name: "contactEmail", type: "string" }),
    defineField({ name: "coverageArea", type: "string" }),
    defineField({ name: "bookingStatus", type: "string" }),
    defineField({ name: "bookingUrl", type: "url" }),
    defineField({ name: "paymentPreferences", type: "text" }),
    defineField({
      name: "social",
      type: "object",
      fields: [
        { name: "instagram", type: "url" },
        { name: "facebook", type: "url" },
        { name: "youtube", type: "url" },
      ],
    }),
    defineField({
      name: "analytics",
      type: "object",
      fields: [{ name: "ga4Id", type: "string" }],
    }),
  ],
});
