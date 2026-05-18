import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Building2, ChevronDown, ChevronUp, ClipboardList, User } from "lucide-react";
import { format, parseISO } from "date-fns";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
];

type RowKey = "experiencesThemes" | "active" | "creative" | "wellbeing" | "imaginative" | "spontaneousChoice";
const ROWS: { key: RowKey; label: string; color: string }[] = [
  { key: "experiencesThemes", label: "Theme", color: "bg-amber-50" },
  { key: "active", label: "Active Play", color: "bg-green-50" },
  { key: "creative", label: "Creative", color: "bg-blue-50" },
  { key: "wellbeing", label: "Wellbeing", color: "bg-rose-50" },
  { key: "imaginative", label: "Imaginative Play", color: "bg-purple-50" },
  { key: "spontaneousChoice", label: "Child's Choice", color: "bg-orange-50" },
];

type WeeklyPlanData = Partial<Record<RowKey, Partial<Record<DayKey, string>>>>;

type Plan = {
  id: number;
  title: string;
  startDate: string | null;
  siteId: number | null;
  siteName: string | null;
  preparedBy: string | null;
  weeklyPlanData: WeeklyPlanData;
};

function WeeklyGrid({ data }: { data: WeeklyPlanData }) {
  const hasContent = ROWS.some((row) =>
    DAYS.some((day) => (data[row.key]?.[day.key] ?? "").trim())
  );

  if (!hasContent) {
    return <p className="text-sm text-muted-foreground italic py-2">No activities entered for this week.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[480px] text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide py-2 px-2 w-28">Activity</th>
            {DAYS.map((d) => (
              <th key={d.key} className="text-center font-semibold text-xs uppercase tracking-wide py-2 px-1 text-muted-foreground">{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const rowHasContent = DAYS.some((d) => (data[row.key]?.[d.key] ?? "").trim());
            if (!rowHasContent) return null;
            return (
              <tr key={row.key} className="border-t border-border/60">
                <td className={`py-2 px-2 font-medium text-xs text-foreground rounded-l align-top ${row.color}`}>
                  {row.label}
                </td>
                {DAYS.map((d) => {
                  const cell = (data[row.key]?.[d.key] ?? "").trim();
                  return (
                    <td key={d.key} className="py-2 px-1 align-top text-center">
                      {cell ? (
                        <span className="text-xs text-foreground whitespace-pre-wrap leading-snug">{cell}</span>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const [expanded, setExpanded] = useState(false);

  const dateLabel = plan.startDate
    ? format(parseISO(plan.startDate), "d MMMM yyyy")
    : plan.title;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="flex flex-row items-start justify-between gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-base leading-tight">{plan.title}</h3>
            <Badge variant="secondary" className="text-xs font-medium bg-emerald-100 text-emerald-800">Published</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-0.5">
            {plan.startDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Week of {dateLabel}
              </span>
            )}
            {plan.siteName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {plan.siteName}
              </span>
            )}
            {plan.preparedBy && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {plan.preparedBy}
              </span>
            )}
          </div>
        </div>
        <button className="shrink-0 text-muted-foreground mt-0.5" aria-label={expanded ? "Collapse" : "Expand"}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-5 pt-0 border-t">
          <WeeklyGrid data={plan.weeklyPlanData} />
        </CardContent>
      )}
    </Card>
  );
}

export default function GuardianPlans() {
  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/auth/my-plans"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-plans");
      if (!res.ok) throw new Error("Failed to load weekly plans");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weekly Program</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Published weekly activity plans from your child's service.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !plans || plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No weekly programs published yet.</p>
            <p className="text-xs mt-1">Check back soon — your service will post the program here each week.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...plans].reverse().map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
