// The one next step on a project (ownerNextStep in src/lib/next-step.ts), with
// its one button. A step that hands off to Compose opens it through
// ComposeLink, so the panel comes into view. One that sends a stage email
// also offers Already sent, and one the Today list shows too Mark handled,
// for work done outside the site (StepSettled).

import Panel from "@/components/ui/Panel";
import Button, { buttonClass } from "@/components/ui/Button";
import ComposeLink from "@/components/admin/ComposeLink";
import StepSettled from "@/components/admin/StepSettled";
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
        <div className="flex flex-wrap items-center gap-4">
          {/* Keyed by the project, so a confirmation outlives the step it settled. */}
          <StepSettled key={projectId} projectId={projectId} sent={step.once} handled={step.handled} />
          {action &&
            (action.href.includes("#compose") ? (
              <ComposeLink href={action.href} className={buttonClass("primary", "md")}>
                {action.label}
              </ComposeLink>
            ) : (
              <Button href={action.href}>{action.label}</Button>
            ))}
        </div>
      </Panel>
    </section>
  );
}
