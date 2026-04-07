import { defineField, defineType } from "sanity";

export const pkg = defineType({
  name: "pkg",
  title: "Package",
  type: "object",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "price", type: "string", validation: (r) => r.required() }),
    defineField({ name: "priceNote", type: "string" }),
    defineField({ name: "duration", type: "string" }),
    defineField({ name: "featured", type: "boolean", initialValue: false }),
    defineField({
      name: "inclusions",
      type: "array",
      of: [{ type: "string" }],
    }),
  ],
});

export const addOn = defineType({
  name: "addOn",
  title: "Add-on",
  type: "object",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "price", type: "string", validation: (r) => r.required() }),
    defineField({ name: "description", type: "string" }),
  ],
});

export const serviceCategory = defineType({
  name: "serviceCategory",
  title: "Service Category",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 60 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "tagline", type: "string" }),
    defineField({ name: "description", type: "text" }),
    defineField({ name: "heroImage", type: "image", options: { hotspot: true } }),
    defineField({ name: "packages", type: "array", of: [{ type: "pkg" }] }),
    defineField({ name: "addOns", type: "array", of: [{ type: "addOn" }] }),
    defineField({ name: "pricingNote", type: "text" }),
    defineField({ name: "order", type: "number" }),
  ],
});
