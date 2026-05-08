import type { Package } from "@/lib/types";

export default function PackageCard({ pkg }: { pkg: Package }) {
  return (
    <div
      className={`rounded-lg border p-6 flex flex-col ${
        pkg.featured
          ? "border-[var(--accent)] bg-white shadow-sm"
          : "border-[var(--border)] bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-2xl">{pkg.name}</h3>
        {pkg.featured && (
          <span className="text-[10px] uppercase tracking-widest text-[var(--accent)]">
            Most popular
          </span>
        )}
      </div>
      {pkg.tagline && (
        <p className="mt-2 text-sm text-[var(--muted)] italic">
          {pkg.tagline}
        </p>
      )}
      <div className="mt-3">
        <div className="text-3xl font-serif">{pkg.price}</div>
        {pkg.priceNote && (
          <div className="text-xs text-[var(--muted)] mt-1">
            {pkg.priceNote}
          </div>
        )}
        {pkg.duration && (
          <div className="text-sm text-[var(--muted)] mt-2">{pkg.duration}</div>
        )}
        {/* Crew configuration sits adjacent to duration since both are
            descriptive metadata about the offering. Photo packages leave
            this unset; wedding-films hybrid + Solo Story Film tiers
            populate it. */}
        {pkg.crewSize && (
          <div className="text-sm text-[var(--muted)] mt-1">
            <span className="text-[var(--accent)] mr-2" aria-hidden>·</span>
            {pkg.crewSize}
          </div>
        )}
      </div>
      <ul className="mt-5 space-y-2 text-sm flex-1">
        {pkg.inclusions.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-[var(--accent)]">—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {/* Honesty disclosure — surfaces a tradeoff that the tier's price
          reflects (e.g. the gear-switch coverage gap on Solo Hybrid).
          Visually distinct from the inclusions list above so it reads
          as a disclosure rather than a feature bullet. */}
      {pkg.honestyNote && (
        <div className="mt-5 pt-4 border-t border-[var(--border)] text-xs leading-relaxed text-[var(--muted)] italic">
          {pkg.honestyNote}
        </div>
      )}
    </div>
  );
}
