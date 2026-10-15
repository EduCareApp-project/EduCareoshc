import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSchoolKidsoftRollQueryKey,
  useGetSchoolKidsoftRoll,
  useRefreshSchoolKidsoftRoll,
} from "@workspace/api-client-react";
import { AlertTriangle, CalendarDays, Link2Off, Loader2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth";
import { useMelbourneToday } from "@/hooks/use-melbourne-today";
import { apiErrorMessage, formatMelbourneDateTime, groupSchoolCareBookings, melbourneToday } from "@/components/kidsoft-utils";

export function SchoolKidsoftRoll({ siteId }: { siteId: number }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const schoolView = user?.type === "school";
  const today = useMelbourneToday();
  const [selectedDate, setDate] = useState(melbourneToday);
  const date = schoolView ? today : selectedDate;
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const params = { date };
  const queryKey = getGetSchoolKidsoftRollQueryKey(siteId, params);
  const { data: response, isLoading, isError, error, refetch } = useGetSchoolKidsoftRoll(siteId, params, {
    query: { queryKey, enabled: !!siteId && /^\d{4}-\d{2}-\d{2}$/.test(date), placeholderData: undefined },
  });
  const data = response?.date === date ? response : undefined;
  const refresh = useRefreshSchoolKidsoftRoll();

  const groups = useMemo(() => groupSchoolCareBookings(data?.bookings ?? []), [data]);
  const otherBookingCount = (data?.bookings.length ?? 0) - groups.reduce((total, group) => total + group.bookings.length, 0);

  async function onRefresh() {
    const target = date;
    setRefreshError(null);
    try {
      const result = await refresh.mutateAsync({ siteId, data: { date: target } });
      queryClient.setQueryData(getGetSchoolKidsoftRollQueryKey(siteId, { date: target }), result);
    } catch (err) {
      setRefreshError(`Refresh failed for ${target}. The previously saved roll is still shown. ${apiErrorMessage(err, "Please try again shortly.")}`);
    }
  }

  const changeDate = (v: string) => { setDate(v); setRefreshError(null); };

  return (
    <div className="space-y-5" data-testid="panel-kidsoft-roll">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Daily Bookings</h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            {schoolView ? "Today's children booked into your OSHC service, from a saved copy." : "Children booked into your OSHC service, from a saved copy."} This is the booked roll, not actual attendance.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            <span className="mb-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{schoolView ? "Today" : "Date"}</span>
            {schoolView ? (
              <span className="flex min-h-9 items-center text-sm text-foreground" data-testid="text-roll-today">
                {new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00Z`))}
              </span>
            ) : <Input type="date" value={date} onChange={(e) => changeDate(e.target.value)} className="w-44" data-testid="input-roll-date" />}
          </label>
          <Button onClick={onRefresh} disabled={refresh.isPending || isLoading || !date || !data?.mapped} data-testid="button-refresh-roll">
            {refresh.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh this day
          </Button>
        </div>
      </div>

      {refreshError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" data-testid="text-refresh-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{refreshError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : isError || !data ? (
        <Card><CardContent className="space-y-3 py-10 text-center">
          <p className="text-sm text-muted-foreground" data-testid="text-roll-error">{apiErrorMessage(error, "The saved roll could not be loaded.")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-roll">Retry</Button>
        </CardContent></Card>
      ) : !data.mapped ? (
        <Card className="border-dashed bg-muted/30 shadow-none"><CardContent className="flex flex-col items-center py-14 text-center" data-testid="state-roll-unmapped">
          <Link2Off className="mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">This service is not linked to a Kidsoft service yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">An EduCare administrator needs to link it in School Portal settings before a roll can be shown.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className={`grid gap-3 rounded-xl border bg-card p-4 ${schoolView ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Service</p>
              <p className="font-medium" data-testid="text-roll-service">{data.serviceName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Last updated (Melbourne)</p>
              <p className="font-medium" data-testid="text-roll-updated">{data.refreshedAt ? formatMelbourneDateTime(data.refreshedAt) : "Not yet refreshed"}</p>
            </div>
            {!schoolView && <div className="flex gap-6">
              <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Bookings</p><p className="text-xl font-semibold" data-testid="text-total-bookings">{data.totalBookings}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Children</p><p className="text-xl font-semibold" data-testid="text-total-children">{data.totalChildren}</p></div>
            </div>}
          </div>

          {!data.refreshedAt ? (
            <Card className="border-dashed bg-muted/30 shadow-none"><CardContent className="py-12 text-center" data-testid="state-roll-not-refreshed">
              <p className="font-medium">No saved roll for this day yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Choose Refresh this day to fetch and save the booked roll for {date}.</p>
            </CardContent></Card>
          ) : data.bookings.length === 0 ? (
            <Card className="border-dashed bg-muted/30 shadow-none"><CardContent className="flex flex-col items-center py-12 text-center" data-testid="state-roll-empty">
              <Users className="mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium">No children were booked on this day</p>
              <p className="mt-1 text-sm text-muted-foreground">This was checked and saved successfully.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {groups.map(({ name: session, bookings: rows }) => (
                <Card key={session} data-testid={`group-session-${session}`}>
                  <div className="flex items-center justify-between rounded-t-xl bg-[#1b5e20] px-4 py-3 text-white">
                    <h4 className="font-semibold">{session}</h4>
                    {!schoolView && <Badge className="border-white/30 bg-white/15 text-white hover:bg-white/15">{rows.length} booked</Badge>}
                  </div>
                  <ul className="divide-y">
                    {!rows.length && <li className="px-4 py-4 text-sm text-muted-foreground">No bookings for this session.</li>}
                    {rows.map((b) => (
                      <li key={b.bookingId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" data-testid={`row-booking-${b.bookingId}`}>
                        <span className="font-medium">{b.childName}</span>
                        <span className="flex items-center gap-3">
                          {b.absent && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Marked absent</Badge>}
                          <span className="tabular-nums text-muted-foreground">{b.startTime} – {b.endTime}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
              {otherBookingCount > 0 && (
                <p className="text-sm text-muted-foreground" role="status">
                  {schoolView
                    ? "Bookings for other session types are not included in these before/after-school lists."
                    : `${otherBookingCount} booking${otherBookingCount === 1 ? "" : "s"} for other session types ${otherBookingCount === 1 ? "is" : "are"} included in the totals but not in these before/after-school lists.`}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Absence flags show what was recorded against the booking. They are not a record of who actually attended.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
