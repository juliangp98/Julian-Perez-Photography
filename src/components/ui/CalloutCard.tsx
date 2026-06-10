import Button from "./Button";

// One shared CTA callout, modeled on the "Booked or seriously considering?"
// box: an accent-bordered white card with an optional uppercase eyebrow, a serif
// title, an optional description, and pill action buttons (the shared Button
// primitive). Used everywhere a page closes with a call to action so they all
// read as one UI.

export type CalloutAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
  external?: boolean;
};

export default function CalloutCard({
  eyebrow,
  title,
  description,
  actions,
  tone = "accent",
  className = "",
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: CalloutAction[];
  tone?: "accent" | "neutral";
  className?: string;
  children?: React.ReactNode;
}) {
  const border =
    tone === "accent" ? "border-[var(--accent)]" : "border-[var(--border)]";
  return (
    <div className={`p-8 border ${border} rounded-lg bg-white ${className}`}>
      {eyebrow && (
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          {eyebrow}
        </div>
      )}
      <h2 className={`font-serif text-2xl ${eyebrow ? "mt-2" : ""}`}>{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {actions.map((a) => (
            <Button
              key={`${a.href}-${a.label}`}
              href={a.href}
              external={a.external}
              variant={a.variant ?? "primary"}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
