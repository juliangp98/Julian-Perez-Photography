import type { ReactNode } from "react";
import type { GuideSection } from "@/lib/discovery-guides";

// The family sections open by default; the shared framework starts folded.
export const OPEN_SECTIONS = new Set(["people", "event", "priorities", "film"]);

// One section of a discovery-call guide, folded: its title and minutes, an
// optional lead line (the AI's tailored opener on a project), the talking
// points, then whatever the caller puts under them (the Call tab's answer
// boxes, or the Content page's list of questions). No hooks, so a server page
// and the Call tab's client component draw it alike.
export default function GuideSectionFold({
  section,
  lead,
  children,
}: {
  section: GuideSection;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <details
      open={OPEN_SECTIONS.has(section.id) || undefined}
      className="group rounded-lg border border-border bg-white p-4"
    >
      <summary className="cursor-pointer list-none">
        <span className="font-serif text-lg">{section.title}</span>
        {section.minutes && <span className="ml-2 text-xs text-muted">{section.minutes}</span>}
      </summary>
      <div className="mt-3 space-y-3">
        {lead && <p className="text-sm text-accent">{lead}</p>}
        {section.say && section.say.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {section.say.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </details>
  );
}
