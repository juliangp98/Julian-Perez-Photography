import Button from "./Button";
import Panel from "./Panel";

// A page's closing call to action: an optional eyebrow, a serif title, a short
// description, and pill buttons.

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
  return (
    <Panel tone={tone === "accent" ? "accent" : "default"} size="lg" className={className}>
      {eyebrow && (
        <div className="text-xs uppercase tracking-[0.2em] text-accent">
          {eyebrow}
        </div>
      )}
      <h2 className={`font-serif text-2xl ${eyebrow ? "mt-2" : ""}`}>{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-muted leading-relaxed">
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
    </Panel>
  );
}
