import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/client", "/portal", "/admin", "/studio", "/api/"],
      },
    ],
    sitemap: "https://julianperezphotography.com/sitemap.xml",
  };
}
