import { useState } from "react";
import { useListPrograms } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks, addMonths, subMonths, format, isWithinInterval, parseISO, isBefore, isAfter } from "date-fns";
import { Link } from "wouter";

function getWeeksInMonth(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  let current = start;
  while (!isAfter(current, end)) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current = new Date(current.getTime() + 86400000);
    }
    weeks.push(week);
  }
  return weeks;
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: programs, isLoading } = useListPrograms();

  const weeks = getWeeksInMonth(currentMonth);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function programsForWeek(weekDays: Date[]) {
    const weekStart = weekDays[0];
    const weekEnd = weekDays[6];
    return (programs ?? []).filter((p) => {
      const pStart = parseISO(p.startDate);
      const pEnd = p.endDate ? parseISO(p.endDate) : pStart;
      return !isAfter(pStart, weekEnd) && !isBefore(pEnd, weekStart);
    });
  }

  const statusColor = (s: string) => ({ active: "bg-green-100 text-green-800", planned: "bg-blue-100 text-blue-800", completed: "bg-slate-100 text-slate-700" }[s] || "bg-slate-100 text-slate-700");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">View programs and learning experiences by week.</p>
        </div>
        <Link href="/programs/new">
          <Button variant="outline">Add Program</Button>
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
              <div className="grid grid-cols-7 bg-muted/50">
                {days.map((d) => <div key={d} className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center">{d}</div>)}
              </div>
              <div className="divide-y">
                {weeks.map((week, wi) => {
                  const weekPrograms = programsForWeek(week);
                  const inMonth = week.some((d) => d.getMonth() === currentMonth.getMonth());
                  return (
                    <div key={wi} className={`grid grid-cols-7 min-h-[80px] ${!inMonth ? "opacity-40" : ""}`}>
                      {week.map((day, di) => (
                        <div key={di} className={`border-r last:border-r-0 px-2 py-1.5 ${day.getMonth() !== currentMonth.getMonth() ? "bg-muted/20" : ""}`}>
                          <p className={`text-xs font-medium ${format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "text-primary" : "text-muted-foreground"}`}>
                            {format(day, "d")}
                          </p>
                        </div>
                      ))}
                      {weekPrograms.length > 0 && (
                        <div className="col-span-7 px-2 pb-2 flex flex-wrap gap-1">
                          {weekPrograms.map((p) => (
                            <Link key={p.id} href="/programs">
                              <Badge className={`text-xs cursor-pointer ${statusColor(p.status)}`}>{p.title}</Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                      {weekPrograms.length === 0 && inMonth && (
                        <div className="col-span-7 px-2 pb-2">
                          <p className="text-xs text-muted-foreground/60 italic">No programs</p>
                        </div>
                      )}
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
          <CardHeader><CardTitle className="text-base">Programs This Month</CardTitle></CardHeader>
          <CardContent>
            {(programs ?? []).filter((p) => {
              const pStart = parseISO(p.startDate);
              const pEnd = p.endDate ? parseISO(p.endDate) : pStart;
              const mStart = startOfMonth(currentMonth);
              const mEnd = endOfMonth(currentMonth);
              return !isAfter(pStart, mEnd) && !isBefore(pEnd, mStart);
            }).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No programs scheduled for {format(currentMonth, "MMMM yyyy")}.</p>
            ) : (
              <div className="space-y-2">
                {(programs ?? []).filter((p) => {
                  const pStart = parseISO(p.startDate);
                  const pEnd = p.endDate ? parseISO(p.endDate) : pStart;
                  const mStart = startOfMonth(currentMonth);
                  const mEnd = endOfMonth(currentMonth);
                  return !isAfter(pStart, mEnd) && !isBefore(pEnd, mStart);
                }).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{format(parseISO(p.startDate), "MMM d")} {p.endDate ? `– ${format(parseISO(p.endDate), "MMM d")}` : ""}</span>
                      <Badge className={`text-xs ${statusColor(p.status)}`}>{p.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
