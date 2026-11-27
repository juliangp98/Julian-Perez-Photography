import { Detail } from "@/components/ui/RailCard";
import { webAddress } from "@/lib/admin-links";
import { bookingTerms } from "@/lib/services-data";
import type { ServiceCategory } from "@/lib/types";

// A service's collections and booking terms: each package with its price and
// what it includes, the add-ons and pricing note, the retainer, date hold and
// gallery turnaround set in Studio, and the sample gallery. A project's Call
// tab and the Content page's Collections tab show the same.
export default function ServiceCollections({
  service,
}: {
  service: Pick<
    ServiceCategory,
    "packages" | "addOns" | "pricingNote" | "retainerPercent" | "holdDays" | "turnaroundDays" | "sampleGalleryUrl"
  >;
}) {
  const packages = service.packages ?? [];
  const addOns = service.addOns ?? [];
  const gallery = webAddress(service.sampleGalleryUrl);
  return (
    <div className="space-y-4 text-sm">
      {packages.length > 0 ? (
        <ul className="space-y-3">
          {packages.map((p, i) => (
            <li key={`${i}-${p.name}`}>
              <div>
                <span className="font-medium">
                  {p.group ? `${p.group}: ` : ""}
                  {p.name}
                </span>
                {`: ${p.price}${p.priceNote ? ` (${p.priceNote})` : ""}${p.duration ? `, ${p.duration}` : ""}`}
              </div>
              {p.inclusions && p.inclusions.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
                  {p.inclusions.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No collections in Studio yet.</p>
      )}
      {addOns.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted">Add-ons</div>
          <ul className="mt-1.5 space-y-1.5">
            {addOns.map((a, i) => (
              <li key={`${i}-${a.name}`}>
                <span className="font-medium">{a.name}</span>
                {`: ${a.price}`}
                {a.description && <div className="text-muted">{a.description}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {service.pricingNote && <p className="text-muted">{service.pricingNote}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {bookingTerms(service).map((t) => (
          <Detail key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
      {gallery ? (
        <a
          href={gallery}
          target="_blank"
          rel="noreferrer"
          className="inline-block underline underline-offset-4 hover:text-accent"
        >
          Sample gallery
        </a>
      ) : (
        <p className="text-muted">No sample gallery in Studio yet.</p>
      )}
    </div>
  );
}
