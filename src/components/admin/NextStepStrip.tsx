// The one next step on a project (ownerNextStep in src/lib/next-step.ts), with
// its one button. A step that hands off to Compose opens it through
// ComposeLink, so the panel comes into view; one that sends a stage email
// also offers "Already sent", for an email that went another way.

import Panel from "@/components/ui/Panel";
import Button, { buttonClass } from "@/components/ui/Button";
import ComposeLink from "@/components/admin/ComposeLink";
import AlreadySent from "@/components/admin/AlreadySent";
import type { NextStep } from "@/lib/next-step";

export default function NextStepStrip({ projectId, step }: { projectId: string; step: NextStep }) {
  const { action } = step;
  return (
    <section aria-label="Next step">
      <Panel tone="accent" className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Next step</div>
          <p className="mt-1 font-medium">{step.title}</p>
          {step.detail && <p className="mt-1 text-sm text-muted">{step.detail}</p>}
        </div>
        {action && (
          <div className="flex flex-wrap items-center gap-4">
            {step.once && <AlreadySent projectId={projectId} template={step.once} />}
            {action.href.includes("#compose") ? (
              <ComposeLink href={action.href} className={buttonClass("primary", "md")}>
                {action.label}
              </ComposeLink>
            ) : (
              <Button href={action.href}>{action.label}</Button>
            )}
          </div>
        )}
      </Panel>
    </section>
  );
}
