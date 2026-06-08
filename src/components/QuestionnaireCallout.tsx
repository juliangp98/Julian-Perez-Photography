import Button from "./Button";
import CalloutCard from "./CalloutCard";
import type { AnswerGroup } from "@/lib/questionnaire-digest";

// One "Planning questionnaire" callout, shared by the admin project page and the
// client portal so both read identically. Two states:
//
// - Not started: a plain, prominent prompt via the shared CalloutCard — a clear
//   "open your questionnaire" card with the primary action, no collapsible
//   chrome (there's nothing to collapse yet).
// - Submitted: a collapsible <details> (the FAQ-accordion pattern, no JS,
//   keyboard- and screen-reader-accessible). Collapsed by default to a
//   "✓ Submitted" card that pops out to the grouped answer read-out, an optional
//   raw-JSON disclosure (admin), and an optional action (resubmit).
//
// Submitted state is derived from the presence of answers or a raw snapshot.

export default function QuestionnaireCallout({
  groups,
  rawSnapshot,
  action,
  title,
  description,
  defaultOpen,
}: {
  groups?: AnswerGroup[] | null;
  rawSnapshot?: string;
  action?: { label: string; href: string };
  title?: string;
  description?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const hasGroups = !!groups && groups.length > 0;
  const submitted = hasGroups || !!rawSnapshot?.trim();

  // Not started — a clear, non-collapsible prompt in the same slot the submitted
  // card occupies, so the call to open the questionnaire is never hidden.
  if (!submitted) {
    return (
      <CalloutCard
        eyebrow="Planning questionnaire"
        title={title ?? "Your planning questionnaire"}
        description={description}
        actions={action ? [{ label: action.label, href: action.href }] : undefined}
      />
    );
  }

  // Submitted — collapsible read-out.
  return (
    <details
      open={defaultOpen ?? false}
      className="group p-6 border border-[var(--accent)] rounded-lg bg-white"
    >
      <summary className="flex items-start justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              Planning questionnaire
            </span>
            <span className="inline-block rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] text-[var(--accent)]">
              ✓ Submitted
            </span>
          </div>
          <div className="mt-1.5 font-serif text-xl">{title ?? "Your answers"}</div>
        </div>
        <span
          aria-hidden
          className="shrink-0 text-2xl leading-none text-[var(--accent)] transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>

      <div className="mt-5">
        {hasGroups ? (
          <div className="space-y-5">
            {groups!.map((g) => (
              <div key={g.section}>
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                  {g.section}
                </div>
                <dl className="mt-2 divide-y divide-[var(--border)]">
                  {g.items.map((it, i) => (
                    <div
                      key={i}
                      className="py-2 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-4"
                    >
                      <dt className="text-sm text-[var(--muted)]">{it.label}</dt>
                      <dd className="mt-0.5 text-sm whitespace-pre-line sm:mt-0">
                        {it.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Your answers are saved to this project.
          </p>
        )}

        {rawSnapshot?.trim() && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-[var(--muted)]">
              View raw JSON
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-[var(--border)]/30 p-4 text-xs">
              {rawSnapshot}
            </pre>
          </details>
        )}

        {action && (
          <div className="mt-5">
            <Button href={action.href}>{action.label}</Button>
          </div>
        )}
      </div>
    </details>
  );
}
