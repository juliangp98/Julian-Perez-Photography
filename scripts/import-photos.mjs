#!/usr/bin/env node
// scripts/import-photos.mjs
//
// Imports portfolio photos exported from Lightroom Classic into the site.
//
// Usage:
//   npm run import-photos -- --source ~/Desktop/portfolio-export
//   npm run import-photos -- --source ~/Desktop/portfolio-export --slug weddings
//   npm run import-photos -- --source ~/Desktop/portfolio-export --dry-run
//
// Expected source layout — one subfolder per portfolio slug, each
// containing the JPEGs Lightroom exported for that gallery:
//
//   ~/Desktop/portfolio-export/
//     weddings/
//       cover.jpg            ← optional; if present, becomes the hero
//       wedding-001.jpg
//       wedding-002.jpg
//       ...
//     engagements-couples/
//       ...
//
// What it does:
//   1. Validates each subfolder against the known portfolio slug list.
//   2. Copies + renames JPEGs into public/portfolio/<slug>/ as
//      <slug>-NN.<ext> in stable, sorted order. The slug folder is wiped
//      first so the numbering stays sequential after additions/removals.
//   3. Promotes any file named cover.* or hero.* to position 1 so it
//      becomes the cover image. Otherwise the alphabetically-first file
//      wins the cover slot.
//   4. Regenerates src/lib/portfolio-manifest.ts. content.ts merges that
//      manifest onto the static portfolio metadata at import time.
//   5. Slugs you don't pass via --source still get preserved in the
//      manifest by reading whatever is currently in public/portfolio/<slug>/,
//      so a single-slug import never wipes the others.
//
// Lightroom Classic export settings I'd recommend pairing with this:
//   - Format: JPEG, quality 80, sRGB
//   - Resize to fit: long edge 2400 px
//   - Output sharpening: Screen, Standard
//   - Metadata: Copyright + Contact only (strip GPS, camera serial, keywords)
//   - File naming: anything sortable; the script renames on copy
//
// After running, alt text defaults to "<slug words> photograph N" — open
// src/lib/portfolio-manifest.ts and override the alt strings before launch
// for accessibility + SEO. (The manifest will be regenerated on the next
// import, so consider keeping any hand-edited alt text in a follow-up
// commit if you re-run this regularly.)

import {
  copyFile,
  mkdir,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_SLUGS = [
  "weddings",
  "engagements-couples",
  "graduation",
  "portraiture",
  "modeling",
  "newborn",
  "family-portraits",
  "family-celebrations",
  "pet",
  "cultural-milestones",
  "maternity",
  "corporate-headshots",
  "corporate-community-events",
  "concerts-performances",
  "brand-commercial",
  "real-estate",
];

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// ---------- arg parsing ----------
const args = process.argv.slice(2);
let source = null;
let onlySlug = null;
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--source") source = args[++i];
  else if (a === "--slug") onlySlug = args[++i];
  else if (a === "--dry-run") dryRun = true;
  else if (a === "--help" || a === "-h") {
    console.log(
      "Usage: npm run import-photos -- --source <dir> [--slug <slug>] [--dry-run]",
    );
    process.exit(0);
  }
}

if (!source) {
  console.error(
    "Error: --source is required.\nUsage: npm run import-photos -- --source <dir> [--slug <slug>] [--dry-run]",
  );
  process.exit(1);
}

// expand ~ and resolve relative paths
if (source.startsWith("~")) source = source.replace("~", process.env.HOME);
source = resolve(source);

if (!existsSync(source)) {
  console.error(`Error: source directory not found: ${source}`);
  process.exit(1);
}

if (onlySlug && !KNOWN_SLUGS.includes(onlySlug)) {
  console.error(
    `Error: --slug ${onlySlug} is not a known portfolio slug.\nKnown slugs:\n  ${KNOWN_SLUGS.join("\n  ")}`,
  );
  process.exit(1);
}

// ---------- paths ----------
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicPortfolio = join(root, "public", "portfolio");
const manifestPath = join(root, "src", "lib", "portfolio-manifest.ts");

// ---------- helpers ----------
function slugToWords(slug) {
  return slug.replace(/-/g, " ");
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function isCoverFile(name) {
  return /^(cover|hero)\b/i.test(basename(name, extname(name)));
}

async function listImages(dir) {
  if (!existsSync(dir)) return [];
  const all = await readdir(dir);
  return all
    .filter((f) => IMG_EXT.has(extname(f).toLowerCase()))
    .sort(naturalSort);
}

// ---------- discover slug folders in source ----------
const sourceEntries = await readdir(source, { withFileTypes: true });
const requestedSlugs = sourceEntries
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => (onlySlug ? name === onlySlug : true))
  .filter((name) => {
    if (!KNOWN_SLUGS.includes(name)) {
      console.warn(`⚠  Skipping unknown subfolder: ${name}`);
      return false;
    }
    return true;
  });

if (requestedSlugs.length === 0) {
  console.error(
    `Error: no valid slug folders found under ${source}.\nExpected subfolders named after portfolio slugs (e.g. weddings, engagements-couples).`,
  );
  process.exit(1);
}

// ---------- process each requested slug ----------
const processed = {};

for (const slug of requestedSlugs) {
  const srcDir = join(source, slug);
  const sourceFiles = await listImages(srcDir);

  if (sourceFiles.length === 0) {
    console.warn(`⚠  ${slug}: no images found in ${srcDir}, skipping`);
    continue;
  }

  // Promote any cover/hero file to position 0.
  const coverIdx = sourceFiles.findIndex((f) => isCoverFile(f));
  const ordered =
    coverIdx > 0
      ? [
          sourceFiles[coverIdx],
          ...sourceFiles.slice(0, coverIdx),
          ...sourceFiles.slice(coverIdx + 1),
        ]
      : sourceFiles;

  const outDir = join(publicPortfolio, slug);
  if (!dryRun) {
    if (existsSync(outDir)) await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
  }

  const newImages = [];
  for (let i = 0; i < ordered.length; i++) {
    const seq = String(i + 1).padStart(2, "0");
    const ext = extname(ordered[i]).toLowerCase().replace(".jpeg", ".jpg");
    const outName = `${slug}-${seq}${ext}`;
    if (!dryRun) {
      await copyFile(join(srcDir, ordered[i]), join(outDir, outName));
    }
    newImages.push({
      src: `/portfolio/${slug}/${outName}`,
      alt: `${slugToWords(slug)} photograph ${i + 1}`,
    });
  }

  processed[slug] = {
    coverImage: newImages[0].src,
    images: newImages,
  };

  console.log(
    `✓ ${slug}: ${newImages.length} image${newImages.length === 1 ? "" : "s"}${dryRun ? " (dry run)" : ""}`,
  );
}

// ---------- preserve untouched slugs by reading their existing public dirs ----------
// This makes single-slug imports safe — we don't want re-running with
// --slug weddings to wipe the manifest entries for every other slug.
for (const slug of KNOWN_SLUGS) {
  if (processed[slug]) continue;
  const dir = join(publicPortfolio, slug);
  const files = await listImages(dir);
  if (files.length === 0) continue;

  const coverIdx = files.findIndex((f) => isCoverFile(f));
  const ordered =
    coverIdx > 0
      ? [files[coverIdx], ...files.slice(0, coverIdx), ...files.slice(coverIdx + 1)]
      : files;

  processed[slug] = {
    coverImage: `/portfolio/${slug}/${ordered[0]}`,
    images: ordered.map((f, i) => ({
      src: `/portfolio/${slug}/${f}`,
      alt: `${slugToWords(slug)} photograph ${i + 1}`,
    })),
  };
}

// ---------- write the manifest ----------
if (!dryRun) {
  const manifestBody = `// AUTO-GENERATED by scripts/import-photos.mjs.
// Do not edit by hand. Re-run \`npm run import-photos -- --source <dir>\` to
// regenerate after exporting fresh JPEGs from Lightroom Classic.
//
// Maps each portfolio slug to the cover image and full gallery list,
// derived from files copied into public/portfolio/<slug>/. content.ts
// merges this map onto the static portfolio metadata so adding or
// removing images is a single command instead of a manual edit.

export type PortfolioManifestEntry = {
  coverImage: string;
  images: { src: string; alt: string }[];
};

export const portfolioManifest: Record<string, PortfolioManifestEntry> = ${JSON.stringify(
    processed,
    null,
    2,
  )};
`;
  await writeFile(manifestPath, manifestBody, "utf8");
  console.log(`\n✓ Wrote ${manifestPath}`);
} else {
  console.log("\n(dry run — manifest not written)");
}

console.log(
  `\nDone. Run \`npm run dev\` to see the updated portfolios at /portfolio.`,
);
