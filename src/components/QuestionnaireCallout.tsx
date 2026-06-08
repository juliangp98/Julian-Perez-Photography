import Button from "./Button";
import type { AnswerGroup } from "@/lib/questionnaire-digest";

// One collapsible "Planning questionnaire" callout, shared by the admin project
// page and the client portal so both read identically. Built on native
// <details>/<summary> (the FAQ-accordion pattern) — no JS, keyboard- and
// screen-reader-accessible. The summary is the collapsed card: an accent
// eyebrow, a state badge (Submitted / Not started yet), and a rotating chevron.
// The body pops out to the grouped answer read-out when a questionnaire is on
// file, or a short "what this covers" description when it isn't, plus an optional
// primary action (open / resubmit) and an optional raw-JSON disclosure (admin).
//
// Submitted state is derived from the presence of answers or a raw snapshot. By
// default a submitted questionnaire starts collapsed (it's reference once filed)
// and a not-started one starts open (so its prompt + action stay visible).

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
  const open = defaultOpen ?? !submitted;
  const heading =
    title ?? (submitted ? "Your answers" : "Your planning questionnaire");

  return (
    <details
      open={open}
      className="group p-6 border border-[var(--accent)] rounded-lg bg-white"
    >
      <summary className="flex items-start justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              Planning questionnaire
            </span>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] ${
                submitted
                  ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {submitted ? "✓ Submitted" : "Not started yet"}
            </span>
          </div>
          <div className="mt-1.5 font-serif text-xl">{heading}</div>
        </div>
        <span
          aria-hidden
          className="shrink-0 text-2xl leading-none text-[var(--accent)] transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>

      <div className="mt-5">
        {submitted ? (
          hasGroups ? (
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
                        <dt className="text-sm text-[var(--muted)]">
                          {it.label}
                        </dt>
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
          )
        ) : (
          description && (
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {description}
            </p>
          )
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
