import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSchoolKidsoftRollQueryKey,
  useGetSchoolKidsoftRoll,
  useRefreshSchoolKidsoftRoll,
} from "@workspace/api-client-react";
import { AlertTriangle, Link2Off, Loader2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMelbourneToday } from "@/hooks/use-melbourne-today";
import { apiErrorMessage, formatMelbourneDateTime, groupSchoolCareBookings, melbourneToday } from "@/components/kidsoft-utils";

export function SchoolKidsoftRoll({ siteId }: { siteId: number }) {
  const queryClient = useQueryClient();
  const date = useMelbourneToday();
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
    const target = melbourneToday();
    setRefreshError(null);
    try {
      const result = await refresh.mutateAsync({ siteId, data: { date: target } });
      queryClient.setQueryData(getGetSchoolKidsoftRollQueryKey(siteId, { date: target }), result);
    } catch (err) {
      setRefreshError(`Refresh failed for ${target}. The previously saved roll is still shown. ${apiErrorMessage(err, "Please try again shortly.")}`);
    }
  }

  return (
    <div className="space-y-5" data-testid="panel-kidsoft-roll">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Daily Bookings</h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            Today's children booked into your OSHC service, from a saved copy. This is the booked roll, not actual attendance.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            <span className="mb-1 block">Today</span>
            <span className="flex min-h-9 items-center text-sm text-foreground" data-testid="text-roll-today">
              {new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00Z`))}
            </span>
          </div>
          <Button onClick={onRefresh} disabled={refresh.isPending || isLoading || !date || !data?.mapped} data-testid="button-refresh-roll">
            {refresh.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh today
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
          <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Service</p>
              <p className="font-medium" data-testid="text-roll-service">{data.serviceName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Last updated (Melbourne)</p>
              <p className="font-medium" data-testid="text-roll-updated">{data.refreshedAt ? formatMelbourneDateTime(data.refreshedAt) : "Not yet refreshed"}</p>
            </div>
          </div>

          {!data.refreshedAt ? (
            <Card className="border-dashed bg-muted/30 shadow-none"><CardContent className="py-12 text-center" data-testid="state-roll-not-refreshed">
              <p className="font-medium">No saved roll for today yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Choose Refresh today to fetch and save today's booked roll.</p>
            </CardContent></Card>
          ) : data.bookings.length === 0 ? (
            <Card className="border-dashed bg-muted/30 shadow-none"><CardContent className="flex flex-col items-center py-12 text-center" data-testid="state-roll-empty">
              <Users className="mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium">No children were booked today</p>
              <p className="mt-1 text-sm text-muted-foreground">This was checked and saved successfully.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {groups.map(({ name: session, bookings: rows }) => (
                <Card key={session} data-testid={`group-session-${session}`}>
                  <div className="flex items-center justify-between rounded-t-xl bg-[#1b5e20] px-4 py-3 text-white">
                    <h4 className="font-semibold">{session}</h4>
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
                  Bookings for other session types are not included in these before/after-school lists.
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
