// Server-only Google Places (New) reviews fetcher.
//
// Reads GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID from env. If either is
// missing, returns an empty payload so the UI can gracefully render
// nothing instead of erroring out.
//
// Cached for 24h via Next's fetch cache so the site hits Google at most
// once per day per region.

// Note: this module is server-only by virtue of reading non-public env
// vars and being imported only from async server components.

export type GoogleReview = {
  author: string;
  authorPhotoUrl: string | null;
  rating: number;
  relativeTime: string;
  text: string;
  language: string;
};

export type GoogleReviewsPayload = {
  reviews: GoogleReview[];
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  businessName: string | null;
};

const EMPTY: GoogleReviewsPayload = {
  reviews: [],
  rating: null,
  reviewCount: null,
  mapsUrl: null,
  businessName: null,
};

type PlacesApiReview = {
  rating?: number;
  text?: { text?: string; languageCode?: string };
  originalText?: { text?: string; languageCode?: string };
  relativePublishTimeDescription?: string;
  authorAttribution?: {
    displayName?: string;
    photoUri?: string;
  };
};

type PlacesApiResponse = {
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlacesApiReview[];
};

export async function fetchGoogleReviews(): Promise<GoogleReviewsPayload> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return EMPTY;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "displayName,rating,userRatingCount,googleMapsUri,reviews",
        },
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) {
      console.error(
        `[google-reviews] Places API ${res.status} ${res.statusText}`,
      );
      return EMPTY;
    }
    const data = (await res.json()) as PlacesApiResponse;

    const reviews: GoogleReview[] = (data.reviews ?? []).map((r) => {
      const original = r.originalText?.text ?? r.text?.text ?? "";
      return {
        author: r.authorAttribution?.displayName ?? "Google reviewer",
        authorPhotoUrl: r.authorAttribution?.photoUri ?? null,
        rating: r.rating ?? 0,
        relativeTime: r.relativePublishTimeDescription ?? "",
        text: original,
        language: r.text?.languageCode ?? r.originalText?.languageCode ?? "en",
      };
    });

    return {
      reviews,
      rating: data.rating ?? null,
      reviewCount: data.userRatingCount ?? null,
      mapsUrl: data.googleMapsUri ?? null,
      businessName: data.displayName?.text ?? null,
    };
  } catch (err) {
    console.error("[google-reviews] fetch failed", err);
    return EMPTY;
  }
}
