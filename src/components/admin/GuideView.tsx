import GuideSectionFold from "./GuideSectionFold";
import type { DiscoveryGuide } from "@/lib/discovery-guides";

// A discovery-call guide to read, section by section, with each section's
// questions listed rather than given answer boxes (the Content page's Call
// guides tab). The Call tab draws the same sections with GuideSectionFold.
export default function GuideView({ guide }: { guide: DiscoveryGuide }) {
  return (
    <div className="space-y-3">
      {guide.sections.map((section) => (
        <GuideSectionFold key={section.id} section={section}>
          {section.questions && section.questions.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">Ask</div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                {section.questions.map((q) => (
                  <li key={q.id}>{q.ask}</li>
                ))}
              </ul>
            </div>
          )}
        </GuideSectionFold>
      ))}
    </div>
  );
}
