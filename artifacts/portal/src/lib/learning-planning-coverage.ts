import { format, isValid, parseISO } from "date-fns";
import { toMelbourneDate } from "./timezone";

type PlanningRecord = {
  siteId?: number | null;
  startDate?: string | null;
  createdAt: string;
  stage: string;
  isTemplate?: boolean;
};

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
