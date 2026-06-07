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
// Alt text: by default each image gets a "<slug words> photograph N"
// placeholder. Pass --alt (with GROQ_API_KEY in .env.local) to generate
// descriptive alt text with AI vision instead. Either way, any existing
// non-placeholder alt is PRESERVED across re-imports — so AI or hand-written
// alt is never wiped (only placeholders get replaced). The admin Content tools
// also let you generate + persist per-image alt overrides (stored in Supabase,
// overlaid at render), which survive imports independently.

import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const KNOWN_SLUGS = [
  "weddings",
  "engagements-couples",
  "graduation",
  "portraiture",
  "modeling",
  "newborn",
  "family-portraits",
  "family-celebrations",
  "cultural-milestones",
  "pet",
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
let altFlag = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--source") source = args[++i];
  else if (a === "--slug") onlySlug = args[++i];
  else if (a === "--dry-run") dryRun = true;
  else if (a === "--alt") altFlag = true;
  else if (a === "--help" || a === "-h") {
    console.log(
      "Usage: npm run import-photos -- --source <dir> [--slug <slug>] [--alt] [--dry-run]\n" +
        "  --alt   generate descriptive alt text with AI vision (needs GROQ_API_KEY)",
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
const aboutManifestPath = join(root, "src", "lib", "about-manifest.ts");

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

async function generateBlurData(filePath) {
  const meta = await sharp(filePath).metadata();
  const buffer = await sharp(filePath)
    .resize(10, undefined, { fit: "inside" })
    .jpeg({ quality: 40 })
    .toBuffer();
  return {
    width: meta.width,
    height: meta.height,
    blurDataURL: `data:image/jpeg;base64,${buffer.toString("base64")}`,
  };
}

// ---------- alt text: env, preservation across regens, AI vision ----------
async function readEnvVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = await readFile(join(root, ".env.local"), "utf8");
    const m = env.match(new RegExp(`^${name}=(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

const groqKey = altFlag ? await readEnvVar("GROQ_API_KEY") : undefined;
const visionModelName =
  (await readEnvVar("AI_VISION_MODEL")) ||
  "meta-llama/llama-4-scout-17b-16e-instruct";
if (altFlag && !groqKey) {
  console.warn(
    "⚠  --alt set but no GROQ_API_KEY (.env.local or env) — using placeholder alt.",
  );
}

// Existing alt per src, so descriptive alt survives manifest regeneration —
// only the slug placeholders are replaced. (JSON.stringify writes the manifest,
// so the value object is parseable JSON.)
const existingAltBySrc = new Map();
try {
  const cur = await readFile(manifestPath, "utf8");
  const start = cur.indexOf("= {");
  const end = cur.lastIndexOf("};");
  if (start !== -1 && end !== -1) {
    const obj = JSON.parse(cur.slice(start + 2, end + 1));
    for (const entry of Object.values(obj)) {
      for (const img of entry.images ?? []) {
        if (img?.src && img?.alt) existingAltBySrc.set(img.src, img.alt);
      }
    }
  }
} catch {
  /* no existing manifest, or unparseable — start fresh */
}

function isPlaceholderAlt(alt, slug) {
  const words = slugToWords(slug).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${words} photograph \\d+$`).test(alt);
}

async function generateAlt(filePath) {
  if (!groqKey) return null;
  try {
    const buf = await readFile(filePath);
    const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: visionModelName,
        messages: [
          {
            role: "system",
            content:
              "You write concise image alt text for accessibility on a photographer's portfolio. Describe what is visibly in the photograph in one phrase, under 125 characters. No 'image of' / 'photo of' / 'picture of'.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Write alt text for this photograph." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 120,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const t = j?.choices?.[0]?.message?.content;
    return typeof t === "string" ? t.trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

// Keep an existing descriptive alt; else generate one with vision (when --alt +
// key + a real file); else fall back to the slug placeholder.
async function resolveAlt({ src, slug, index, filePath, allowVision }) {
  const existing = existingAltBySrc.get(src);
  if (existing && !isPlaceholderAlt(existing, slug)) return existing;
  if (allowVision && groqKey && filePath && !dryRun) {
    const ai = await generateAlt(filePath);
    if (ai) {
      console.log(`    alt: ${ai}`);
      return ai;
    }
  }
  return `${slugToWords(slug)} photograph ${index + 1}`;
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
    const outPath = join(outDir, outName);
    if (!dryRun) {
      await copyFile(join(srcDir, ordered[i]), outPath);
    }
    const blur = dryRun
      ? { width: 0, height: 0, blurDataURL: "" }
      : await generateBlurData(outPath);
    const src = `/portfolio/${slug}/${outName}`;
    const alt = await resolveAlt({
      src,
      slug,
      index: i,
      filePath: dryRun ? null : outPath,
      allowVision: true,
    });
    newImages.push({ src, alt, ...blur });
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
// This makes single-slug imports safe — re-running with `--slug
// weddings` should not wipe the manifest entries for every other slug.
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

  const images = [];
  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i];
    const blur = await generateBlurData(join(dir, f));
    const src = `/portfolio/${slug}/${f}`;
    const alt = await resolveAlt({
      src,
      slug,
      index: i,
      filePath: join(dir, f),
      allowVision: false,
    });
    images.push({ src, alt, ...blur });
  }
  processed[slug] = {
    coverImage: `/portfolio/${slug}/${ordered[0]}`,
    images,
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
  images: { src: string; alt: string; width: number; height: number; blurDataURL: string }[];
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

// ---------- about page sidebar photos ----------
// Optional: a source `about/` subfolder → public/about/ + src/lib/about-manifest.ts.
// Skipped entirely when the source has no `about/` folder, so a portfolio-only
// import never touches the about photos.
async function processAbout() {
  const aboutSrc = join(source, "about");
  if (!existsSync(aboutSrc)) return;
  const files = await listImages(aboutSrc);
  if (files.length === 0) {
    console.warn(`⚠  about: no images found in ${aboutSrc}, skipping`);
    return;
  }
  const outDir = join(root, "public", "about");
  const paths = [];
  if (!dryRun) {
    if (existsSync(outDir)) await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
  }
  for (let i = 0; i < files.length; i++) {
    const seq = String(i + 1).padStart(2, "0");
    const ext = extname(files[i]).toLowerCase().replace(".jpeg", ".jpg");
    const outName = `about-${seq}${ext}`;
    if (!dryRun) await copyFile(join(aboutSrc, files[i]), join(outDir, outName));
    paths.push(`/about/${outName}`);
  }
  if (dryRun) {
    console.log(`about: ${files.length} image(s) (dry run)`);
    return;
  }
  const body = `// AUTO-GENERATED by scripts/import-photos.mjs (the \`about/\` source folder).
// Do not edit by hand. Re-run \`npm run import-photos -- --source <dir>\` with an
// \`about/\` subfolder to regenerate.
//
// Paths to the /about sidebar photos, copied into public/about/. content.ts
// merges these onto the about page (they win over any manually-set paths).

export const aboutImages: string[] = ${JSON.stringify(paths, null, 2)};
`;
  await writeFile(aboutManifestPath, body, "utf8");
  console.log(
    `✓ about: ${paths.length} image${paths.length === 1 ? "" : "s"} → ${aboutManifestPath}`,
  );
}
await processAbout();

console.log(
  `\nDone. Run \`npm run dev\` to see the updated portfolios at /portfolio.`,
);
