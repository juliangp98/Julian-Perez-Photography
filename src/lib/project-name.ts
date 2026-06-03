// Friendly project naming. A project shows a real name — a custom one the client
// or admin set, or otherwise an auto name built from who + what + when, e.g.
// "Julian Perez's Wedding on 6/7" or "Carolyn Schook's Maternity Session on 5/9"
// — instead of the bare service slug. Pure + dependency-free so both the portal
// and the admin can share it.

// Service slug → a singular, human noun for the project name.
const SERVICE_NOUN: Record<string, string> = {
  weddings: "Wedding",
  "wedding-films": "Wedding Film",
  "engagements-couples": "Engagement",
  maternity: "Maternity Session",
  newborn: "Newborn Session",
  "family-portraits": "Family Session",
  "family-celebrations": "Family Celebration",
  "cultural-milestones": "Cultural Milestone",
  pet: "Pet Session",
  portraiture: "Portrait Session",
  graduation: "Graduation Session",
  "corporate-headshots": "Headshots",
  "corporate-community-events": "Event",
  "concerts-performances": "Performance",
  "brand-commercial": "Brand Shoot",
  "real-estate": "Real Estate Shoot",
  modeling: "Modeling Session",
};

function serviceNoun(serviceType?: string): string | null {
  if (!serviceType) return null;
  return (
    SERVICE_NOUN[serviceType] ||
    serviceType
      .split("-")
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}

function possessive(name: string): string {
  return `${name.trim()}'s`;
}

// "6/7" from an event-date string (ISO "2026-06-07", "6/7/2026", "Jun 7, 2026");
// null if unparseable.
function shortDate(d?: string): string | null {
  if (!d) return null;
  let date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
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
