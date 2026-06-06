import { useEffect } from "react";
import { useSearch, Redirect } from "wouter";
import { useGetPlanningExperience, getGetPlanningExperienceQueryKey, useListSites } from "@workspace/api-client-react";
import { Printer } from "lucide-react";
import {
  initGridFromPlan, ROW_LABELS, DAY_KEYS, DAY_LABELS,
  bubbleClassForSub,
  type CellOutcomes,
} from "@/components/read-only-plan-view";
import { format } from "date-fns";

export default function WeeklyPlanPrint() {
  const search = useSearch();
  const idParam = new URLSearchParams(search).get("id");
  const id = idParam ? parseInt(idParam, 10) : null;

  const { data: plan, isLoading, isError } = useGetPlanningExperience(
    id ?? 0,
    { query: { queryKey: getGetPlanningExperienceQueryKey(id ?? 0), enabled: id !== null } },
  );
  const { data: sites } = useListSites();

  const siteName = plan?.siteId
    ? (sites ?? []).find((s) => s.id === plan.siteId)?.name
    : undefined;

  useEffect(() => {
    if (!plan) return;
    const timeout = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timeout);
  }, [plan]);

  if (!id) return <Redirect to="/planning" />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <Printer className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">Preparing weekly plan for printing…</p>
        </div>
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-destructive">Could not load the weekly plan.</p>
      </div>
    );
  }

  const grid = initGridFromPlan(plan);
  const cellOutcomes: CellOutcomes = (plan.weeklyPlanData as any)?.cellOutcomes ?? {};

  const startDate = plan.startDate
    ? format(new Date(plan.startDate as unknown as string), "dd/MM/yyyy")
    : null;

  return (
    <>
      <style>{`@page { size: landscape; margin: 12mm; }`}</style>

      {/* Screen-only controls */}
      <div className="print:hidden fixed top-0 inset-x-0 bg-white border-b shadow-sm z-10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/educare-logo.png" alt="EduCare" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-sm font-semibold">{plan.title ?? "Weekly Plan"}</p>
            <p className="text-xs text-muted-foreground">
              {[siteName, startDate ? `Week of ${startDate}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1a4d6e] text-white text-sm font-medium hover:bg-[#15405c] transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Print content */}
      <div className="pt-16 print:pt-0 px-6 print:px-0 pb-8">
        {/* Print header */}
        <div className="print:flex hidden items-start justify-between mb-6 pb-4 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <img src="/educare-logo.png" alt="EduCare" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">EduCare</p>
              <p className="text-sm text-gray-400">Printed {format(new Date(), "dd/MM/yyyy")}</p>
            </div>
          </div>
          {siteName && (
            <p className="text-sm text-gray-600">{siteName}</p>
          )}
        </div>

        {/* Title */}
        <div className="mb-4 print:mb-5">
          <h1 className="text-xl font-bold text-gray-900 print:text-2xl">{plan.title ?? "Weekly Plan"}</h1>
          {startDate && (
            <p className="text-sm text-gray-500 mt-0.5">Week of {startDate}</p>
          )}
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#1a4d6e", color: "white" }}>
                <th className="border border-blue-900 px-3 py-2.5 text-left font-semibold w-36 print:w-28" />
                {DAY_LABELS.map((d) => (
                  <th key={d} className="border border-blue-900 px-2 py-2.5 text-center font-semibold">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_LABELS.map(({ key, label }, ri) => (
                <tr key={key} style={{ backgroundColor: ri % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td className="border border-slate-200 px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap align-top print:text-[11px]">
                    {label}
                  </td>
                  {DAY_KEYS.map((day) => {
                    const ck = `${key}-${day}`;
                    const outcomes = cellOutcomes[ck] ?? [];
                    const text = grid[key][day];
                    return (
                      <td key={day} className="border border-slate-200 px-2 py-2.5 align-top min-w-[100px] print:min-w-0">
                        {text && (
                          <p className="whitespace-pre-wrap text-slate-800 mb-1 leading-snug print:text-[11px]">{text}</p>
                        )}
                        {outcomes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {outcomes.map((subId) => (
                              <span
                                key={subId}
                                className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${bubbleClassForSub(subId)}`}
                              >
                                {subId}
                              </span>
                            ))}
                          </div>
                        )}
                        {!text && outcomes.length === 0 && (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 hidden print:flex items-center justify-between text-[10px] text-gray-400">
          <span>EduCare — Weekly Plan</span>
          <span>Printed {format(new Date(), "dd/MM/yyyy 'at' h:mm a")}</span>
        </div>
      </div>
    </>
  );
}
