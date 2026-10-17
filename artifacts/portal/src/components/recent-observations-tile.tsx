import { useId } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useGetRecentObservations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";

export function RecentObservationsTile({ preferences }: { preferences: ReturnType<typeof useDashboardPreferences> }) {
  const { data: observations, isLoading, isError, refetch } = useGetRecentObservations();
  const contentId = useId();
  const { collapsed, loading, error, saving, toggle, retry } = preferences;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center gap-2 text-lg">
          <span>Recent Observations</span>
          <div className="flex items-center gap-2">
            <Link href="/observations"><span className="whitespace-nowrap text-sm text-primary font-normal cursor-pointer hover:underline">View all</span></Link>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              aria-label={`${collapsed ? "Expand" : "Collapse"} Recent Observations`}
              aria-expanded={!collapsed}
              aria-controls={contentId}
              disabled={loading || error || saving}
              onClick={toggle}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <div id={contentId} hidden={collapsed && !error}>
        <CardContent className="p-0">
          {error ? (
            <div role="alert" className="space-y-2 p-4 text-sm text-destructive">
              <p>Your saved open/closed setting could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={retry}>Retry settings</Button>
            </div>
          ) : loading || isLoading ? (
            <div className="space-y-4 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : isError ? (
            <div role="alert" className="space-y-2 p-4 text-sm text-destructive">
              <p>Recent observations could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry observations</Button>
            </div>
          ) : !observations?.length ? (
            <div className="text-center py-8 text-muted-foreground">No recent observations</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {["Date", "Child", "Observation", "Site", "Submitter"].map(heading => (
                      <th key={heading} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {observations.slice(0, 10).map(obs => (
                    <tr key={obs.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top">
                        {format(new Date(obs.observationDate.length === 10 ? `${obs.observationDate}T00:00:00` : obs.observationDate), "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap align-top">
                        {obs.childName ?? <span className="text-muted-foreground italic">Unknown</span>}
                      </td>
                      <td className="px-4 py-3 align-top max-w-xs">
                        <Link href={`/observations/${obs.id}`}>
                          <span className="line-clamp-2 cursor-pointer hover:text-primary transition-colors leading-snug">{obs.description}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top" title={obs.siteName ?? undefined}>
                        {obs.siteIdentifier || <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top">
                        {obs.staffName ?? <span className="italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
