import { useState } from "react";
import { useListPlanningExperiences } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Layers, ArrowRight } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, format, parseISO, isBefore, isAfter,
} from "date-fns";
import { Link, useLocation } from "wouter";

function getWeeksInMonth(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  let current = start;
  while (!isAfter(current, end)) {
    const week: Date[] = [];
    for (let i = 0; i < 5; i++) {
      week.push(new Date(current));
      current = new Date(current.getTime() + 86400000);
    }
    current = new Date(current.getTime() + 86400000 * 2);
    weeks.push(week);
  }
  return weeks;
}

const TODAY = format(new Date(), "yyyy-MM-dd");

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [, navigate] = useLocation();
  const { data: planning, isLoading } = useListPlanningExperiences();

  const weeks = getWeeksInMonth(currentMonth);
  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  function cyclesForWeek(weekDays: Date[]) {
    const weekStart = weekDays[0];
    const weekEnd = weekDays[4];
    return (planning ?? []).filter((p) => {
      if (p.stage !== "planned") return false;
      const pStart = parseISO(p.startDate);
      return !isAfter(pStart, weekEnd) && !isBefore(pStart, weekStart);
    });
  }

  const stageColor = (stage: string) =>
    ({ planned: "bg-blue-100 text-blue-800", assessment: "bg-amber-100 text-amber-800", complete: "bg-green-100 text-green-800" }[stage] ?? "bg-slate-100 text-slate-700");

  const plannedThisMonth = (planning ?? []).filter((p) => {
    if (p.stage !== "planned") return false;
    const pStart = parseISO(p.startDate);
    return !isAfter(pStart, endOfMonth(currentMonth)) && !isBefore(pStart, startOfMonth(currentMonth));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">View planning cycles and programs by week.</p>
        </div>
        <Link href="/planning/new">
          <Button variant="outline">New Planning Cycle</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid bg-muted/50" style={{ gridTemplateColumns: "repeat(5, 1fr) 80px 80px" }}>
                {weekDayHeaders.map((d) => (
                  <div key={d} className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center border-r last:border-r-0">{d}</div>
                ))}
                <div className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center border-r" />
                <div className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center" />
              </div>

              <div className="divide-y">
                {weeks.map((weekDays, wi) => {
                  const weekCycles = cyclesForWeek(weekDays);
                  const inMonth = weekDays.some((d) => d.getMonth() === currentMonth.getMonth());
                  const weekStart = weekDays[0];
                  const weekLabel = format(weekStart, "yyyy-MM-dd");
                  return (
                    <div key={wi} className={`${!inMonth ? "opacity-40" : ""}`}>
                      <div className="grid min-h-[72px]" style={{ gridTemplateColumns: "repeat(5, 1fr) 80px 80px" }}>
                        {weekDays.map((day, di) => (
                          <div
                            key={di}
                            className={`border-r px-2 py-1.5 ${day.getMonth() !== currentMonth.getMonth() ? "bg-muted/20" : ""}`}
                          >
                            <p className={`text-xs font-medium ${format(day, "yyyy-MM-dd") === TODAY ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              {format(day, "d")}
                            </p>
                            <div className="mt-1 space-y-0.5">
                              {weekCycles.filter((c) => format(parseISO(c.startDate), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")).map((c) => (
                                <Link key={c.id} href={`/planning/${c.id}`}>
                                  <div className="text-[10px] truncate rounded px-1 py-0.5 bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 leading-tight">{c.title}</div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}

                        <div className="border-r flex items-center justify-center px-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-8"
                            onClick={() => navigate(`/planning/new`)}
                          >
                            Plan
                          </Button>
                        </div>
                        <div className="flex items-center justify-center px-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-8"
                            onClick={() => navigate(`/planning`)}
                          >
                            Publish
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Planning Cycles This Month</CardTitle>
                {plannedThisMonth.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-800">{plannedThisMonth.length} planned</Badge>
                )}
              </div>
              <Link href="/planning">
                <span className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {plannedThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No planned cycles starting in {format(currentMonth, "MMMM yyyy")}.
              </p>
            ) : (
              <div className="divide-y">
                {plannedThisMonth.map((p) => (
                  <Link key={p.id} href={`/planning/${p.id}`}>
                    <div className="flex items-center justify-between py-3 px-1 hover:bg-muted/50 rounded cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Starts {format(parseISO(p.startDate), "MMM d, yyyy")}
                          {p.preparedBy ? ` · By ${p.preparedBy}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800 text-xs">Planned</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
