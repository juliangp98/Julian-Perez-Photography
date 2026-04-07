import { defineField, defineType } from "sanity";

export const aboutPage = defineType({
  name: "aboutPage",
  title: "About Page",
  type: "document",
  fields: [
    defineField({ name: "headshot", type: "image", options: { hotspot: true } }),
    defineField({ name: "bio", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "approach", type: "text" }),
    defineField({ name: "coverageArea", type: "string" }),
  ],
});
