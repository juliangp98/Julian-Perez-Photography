// `tz-lookup` ships no type declarations. It exports a single function mapping
// coordinates to an IANA timezone name (e.g. tzlookup(38.9, -77.0) →
// "America/New_York").
declare module "tz-lookup" {
  export default function tzlookup(lat: number, lon: number): string;
}
