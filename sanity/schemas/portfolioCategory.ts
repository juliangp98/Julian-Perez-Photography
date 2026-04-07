import { defineField, defineType } from "sanity";

export const galleryImage = defineType({
  name: "galleryImage",
  title: "Gallery Image",
  type: "object",
  fields: [
    defineField({
      name: "image",
      type: "image",
      options: { hotspot: true },
      validation: (r) => r.required(),
    }),
    defineField({ name: "alt", type: "string", validation: (r) => r.required() }),
    defineField({ name: "caption", type: "string" }),
    defineField({ name: "featured", type: "boolean", initialValue: false }),
  ],
});

export const portfolioCategory = defineType({
  name: "portfolioCategory",
  title: "Portfolio Category",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 60 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "description", type: "text" }),
    defineField({ name: "coverImage", type: "image", options: { hotspot: true } }),
    defineField({ name: "order", type: "number" }),
    defineField({
      name: "images",
      type: "array",
      of: [{ type: "galleryImage" }],
    }),
  ],
});
