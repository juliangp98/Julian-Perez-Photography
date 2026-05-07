/**
 * Upload a local video file to Vercel Blob and print the public URL.
 *
 * Use case: wedding films whose music tracks get blocked on YouTube need
 * to be self-hosted. This script handles the upload step so the URL can
 * be pasted into the matching `videoEntry`'s "Blob URL" field in Sanity
 * Studio.
 *
 * Prereqs:
 *   - `BLOB_READ_WRITE_TOKEN` in `.env.local`. Create one at
 *     https://vercel.com/<account>/<project>/stores → your Blob store →
 *     "Connect" → copy the read-write token. The same token already in
 *     use for questionnaire uploads works fine. It can stay in
 *     `.env.local` between uploads — unlike the Sanity write token,
 *     this one's blast radius is limited to the blob store.
 *
 * Usage:
 *   npm run upload-video -- ./path/to/wedding-film.mp4
 *
 * What it does:
 *   - Reads the file from disk.
 *   - Uploads to Vercel Blob under the key
 *     `wedding-films/<basename>` with a randomized suffix (Vercel's
 *     `addRandomSuffix` default) so re-uploads don't collide.
 *   - Prints the public URL.
 *
 * Notes:
 *   - Files larger than ~4.5 MB stream in chunks automatically (the
 *     `@vercel/blob` `put` helper handles multipart for large
 *     payloads). Wedding films at 500 MB-1 GB upload fine.
 *   - The blob is set to public access — there's no auth gate on
 *     playback. Don't upload anything you wouldn't want shared.
 *   - Thumbnail still needs to be exported manually from the editor
 *     and dropped at `/public/portfolio/wedding-films/thumbnails/...`.
 */
import { put } from "@vercel/blob";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("✖ Missing file path.");
  console.error("  Usage: npm run upload-video -- ./path/to/video.mp4");
  process.exit(1);
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("✖ BLOB_READ_WRITE_TOKEN is not set.");
  console.error(
    "  Add it to .env.local from your Vercel Blob store's Connect tab.",
  );
  process.exit(1);
}

async function upload() {
  const data = await readFile(filePath);
  const sizeMB = (data.byteLength / (1024 * 1024)).toFixed(1);
  const key = `wedding-films/${basename(filePath)}`;
  console.log(`→ Uploading ${basename(filePath)} (${sizeMB} MB) to ${key}…`);
  const result = await put(key, data, {
    access: "public",
    token,
    contentType: "video/mp4",
  });
  console.log("");
  console.log(`✔ Uploaded.`);
  console.log(`  URL: ${result.url}`);
  console.log("");
  console.log(
    "  Paste the URL above into the videoEntry's 'Blob URL' field in Sanity Studio,",
  );
  console.log(
    "  set Source Kind to 'Self-hosted (Vercel Blob)', and remember to drop a",
  );
  console.log(
    "  thumbnail at /public/portfolio/wedding-films/thumbnails/<slug>.jpg.",
  );
}

upload().catch((err) => {
  console.error("✖ Upload failed:", err);
  process.exit(1);
});
