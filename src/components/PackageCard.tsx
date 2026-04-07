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
      </div>
      <ul className="mt-5 space-y-2 text-sm flex-1">
        {pkg.inclusions.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-[var(--accent)]">—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
