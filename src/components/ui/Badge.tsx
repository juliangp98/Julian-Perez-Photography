// A small rounded label for a status read at a glance (fit, urgency).
const TONES = {
  good: "bg-green-50 text-green-800 border-green-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  bad: "bg-red-50 text-danger border-red-200",
  muted: "bg-border/40 text-muted border-border",
};
export type BadgeTone = keyof typeof TONES;

export default function Badge({
  tone,
  children,
  className = "",
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${TONES[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
