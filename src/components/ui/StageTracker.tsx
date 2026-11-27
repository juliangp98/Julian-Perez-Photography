import { stageLine, stagesFor, type StageProject } from "@/lib/client-status";

// Where a project is on its path, as a row of steps: the ones done filled in,
// the current one marked, the rest still to come. A step the project passed
// over isn't shown. Server-safe; the admin project page's header and the
// client's portal page draw it.
// Below the large breakpoint only the step line is visible and the step names
// are read out to screen readers.
export default function StageTracker({ project }: { project: StageProject }) {
  const { stages, closed } = stagesFor(project);
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{stageLine(project)}</p>
      <ol aria-label="Stages" className="mt-2 flex gap-1">
        {stages.map((s) => (
          <li
            key={s.key}
            aria-current={s.state === "current" && !closed ? "step" : undefined}
            className="min-w-0 flex-1"
          >
            <span
              aria-hidden
              className={`block h-1.5 rounded-full ${
                s.state === "done"
                  ? "bg-accent"
                  : s.state === "current"
                    ? closed
                      ? "bg-muted"
                      : "bg-foreground"
                    : "bg-border"
              }`}
            />
            <span
              className={`sr-only lg:not-sr-only lg:mt-1.5 lg:block lg:text-[10px] lg:uppercase lg:leading-tight lg:tracking-wide ${
                s.state === "upcoming" ? "text-muted" : "text-foreground"
              }`}
            >
              {s.label}
              <span className="sr-only">
                {s.state === "done"
                  ? ", done"
                  : s.state === "current"
                    ? closed
                      ? ", closed here"
                      : ", now"
                    : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
