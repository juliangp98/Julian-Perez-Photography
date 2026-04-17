import { siteSettings } from "./siteSettings";
import {
  serviceCategory,
  pkg,
  addOn,
} from "./serviceCategory";
import {
  portfolioCategory,
  galleryImage,
} from "./portfolioCategory";
import { aboutPage } from "./aboutPage";
import { journalPost } from "./journalPost";

// `schemaTypes` is the full catalog — the Studio config (sanity.config.ts) is
// free to register a narrower set so dormant schemas stay invisible to editors
// until their rendering side ships.
export const schemaTypes = [
  siteSettings,
  serviceCategory,
  pkg,
  addOn,
  portfolioCategory,
  galleryImage,
  aboutPage,
  journalPost,
];

export { journalPost };
