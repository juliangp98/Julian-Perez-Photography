// Friendly project naming: a custom name when set, otherwise an auto name
// built from who + what + when, e.g. "Julian Perez's Wedding on 6/7/2026".

import { services } from "./services-data";
import { titleCaseSlug } from "./labels";
import { eventDay } from "./field-format";

// Service slug → a singular, human noun for the project name.
export function serviceNoun(serviceType?: string): string | null {
  if (!serviceType) return null;
  return (
    services.find((s) => s.slug === serviceType)?.noun ||
    titleCaseSlug(serviceType)
  );
}

function possessive(name: string): string {
  return `${name.trim()}'s`;
}

// "6/7/2026" from an event date that names one day (any shape eventDay reads:
// "2026-06-07", "6/7/2026", "Jun 7, 2026"); null otherwise, so a name never
// carries a guessed day.
function shortDate(d?: string): string | null {
  const day = eventDay(d);
  if (!day) return null;
  const [y, m, dd] = day.split("-").map(Number);
  return `${m}/${dd}/${y}`;
}

export type NameableRecord = {
  projectName?: string;
  clientName?: string;
  serviceType?: string;
  eventDate?: string;
};

// The auto name, assembled from whatever fields are present.
export function autoProjectName(r: NameableRecord): string {
  const noun = serviceNoun(r.serviceType);
  const date = shortDate(r.eventDate);
  const who = r.clientName?.trim();

  let base: string;
  if (who && noun) base = `${possessive(who)} ${noun}`;
  else if (noun) base = noun;
  else if (who) base = `${possessive(who)} Project`;
  else base = "Project";

  return date ? `${base} on ${date}` : base;
}

// The display name: a custom name when set, otherwise the auto name.
export function projectDisplayName(r: NameableRecord): string {
  return r.projectName?.trim() || autoProjectName(r);
}
