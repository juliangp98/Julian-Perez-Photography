// Server-only Google Places (New) autocomplete. Reuses GOOGLE_PLACES_API_KEY
// (the same key as google-reviews.ts). Predictions are built from each
// suggestion's `structuredFormat`, so there's NO follow-up Place Details call —
// no extra per-select billing. Returns [] when the key is missing or the query
// is too short, so the UI degrades to plain free-text entry.

export type PlacePrediction = {
  mainText: string; // venue / street line
  secondaryText: string; // city, region, country
  fullText: string; // the whole formatted line
  placeId: string;
};

type AutocompleteApiResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

export async function fetchPlacePredictions(
  input: string,
): Promise<PlacePrediction[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const query = input.trim();
  if (!key || query.length < 3) return [];

  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({ input: query, regionCode: "US" }),
    },
  );
  if (!res.ok) {
    throw new Error(`Places autocomplete ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as AutocompleteApiResponse;
  const out: PlacePrediction[] = [];
  for (const s of data.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p) continue;
    const mainText = p.structuredFormat?.mainText?.text ?? p.text?.text ?? "";
    if (!mainText) continue;
    out.push({
      mainText,
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      fullText: p.text?.text ?? mainText,
      placeId: p.placeId ?? "",
    });
  }
  return out;
}
