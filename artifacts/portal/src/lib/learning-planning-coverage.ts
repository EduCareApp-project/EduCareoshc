import { format, isValid, parseISO } from "date-fns";
import { toMelbourneDate } from "./timezone";

type PlanningRecord = {
  siteId?: number | null;
  startDate?: string | null;
  createdAt: string;
  stage: string;
  isTemplate?: boolean;
};

/**
 * Learning Cycles save MTOP links in frameworkLinks, while other planning
 * records use outcomeIds. Count each parent outcome once per plan, including
 * when it is linked in both representations or via multiple sub-outcomes.
 */
export function planningOutcomeIds(plan: {
  outcomeIds?: (number | string)[] | null;
  frameworkLinks?: string | null;
}): number[] {
  const outcomes = new Set<number>();
  for (const id of plan.outcomeIds ?? []) {
    const value = typeof id === "string" ? id.trim() : String(id);
    if (/^[1-5](?:\.\d+)?$/.test(value)) outcomes.add(Number(value[0]));
  }
  const text = plan.frameworkLinks ?? "";
  // Support inserted sub-outcome codes and written headings such as
  // "MTOP Outcome 1 – Children have a strong sense of identity".
  for (const match of text.matchAll(/(?:^|[^\w.])([1-5])\.\d+(?![\w.])|\b(?:MTOP\s+)?Outcome\s+([1-5])\b/gi)) {
    outcomes.add(Number(match[1] ?? match[2]));
  }
  return [...outcomes].sort((a, b) => a - b);
}

export function filterPlanningCoverage<T extends PlanningRecord>(
  plans: T[] | undefined,
  options: { selectedSite: string; cutoff: Date; today: string; includeFuturePlans: boolean },
): T[] {
  const firstDate = format(options.cutoff, "yyyy-MM-dd");
  return (plans ?? []).filter((plan) => {
    if (plan.isTemplate || (options.selectedSite !== "all" && String(plan.siteId) !== options.selectedSite)) return false;
    try {
      // Scheduled dates are calendar dates; only creation timestamps need timezone conversion.
      const date = plan.startDate
        ? plan.startDate.slice(0, 10)
        : format(toMelbourneDate(plan.createdAt), "yyyy-MM-dd");
      if (!isValid(parseISO(date))) return false;
      if (date >= firstDate && date <= options.today) return true;
      return options.includeFuturePlans && date > options.today && plan.stage !== "closed";
    } catch {
      return false;
    }
  });
}
