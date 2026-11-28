// The Today list's rows from the store's projects: each project's display
// name and its service's terms (turnaround days, whether it has a planning
// questionnaire), handed to the pure rules in ./today. The board and the
// morning email both build their rows here, so they always agree.

import type { ClientRecordFull } from "./clients";
import { projectDisplayName } from "./project-name";
import { QUESTIONNAIRES } from "./questionnaires";
import { todayRows, type TodayRow } from "./today";
import type { ServiceCategory } from "./types";

export function todayListFor(
  records: ClientRecordFull[],
  services: Pick<ServiceCategory, "slug" | "turnaroundDays">[],
  today: string,
): TodayRow[] {
  const terms = new Map(
    services.map((svc) => [
      svc.slug as string,
      { turnaroundDays: svc.turnaroundDays, questionnaire: svc.slug in QUESTIONNAIRES },
    ]),
  );
  return todayRows(
    records.map((r) => ({ ...r, name: projectDisplayName(r) })),
    today,
    (slug) => (slug ? terms.get(slug) : undefined),
  );
}
