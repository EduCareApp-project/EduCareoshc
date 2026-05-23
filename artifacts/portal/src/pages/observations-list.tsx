import { useListObservations, useListChildren } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Calendar, User, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isEqual } from "date-fns";
import { useState, useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";

export default function ObservationsList() {
  const { isEducatorRole, ownSiteId } = usePermissions();
  const { data: observations, isLoading } = useListObservations();
  const { data: children } = useListChildren();
  const [search, setSearch] = useState("");

  const childSiteMap = useMemo(
    () => new Map((children ?? []).map((c) => [c.id, c.siteId ?? null])),
    [children],
  );

  const filteredObs = observations?.filter((obs) => {
    if (isEducatorRole && ownSiteId) {
      const childSite = childSiteMap.get(obs.childId);
      if (childSite !== undefined && childSite !== ownSiteId) return false;
    }
    const q = search.toLowerCase();
    return (
      obs.description.toLowerCase().includes(q) ||
      obs.childName?.toLowerCase().includes(q) ||
      obs.staffName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Observations</h1>
          <p className="text-muted-foreground mt-1">Review and manage learning observations.</p>
        </div>
        <Link href="/observations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Observation
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by child, educator or observation..."
          className="pl-9 max-w-md bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : filteredObs?.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-dashed">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-1">No observations found</h3>
          <p className="text-muted-foreground">Document a child's learning moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredObs?.map((obs) => (
            <Link key={obs.id} href={`/observations/${obs.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-5 flex flex-col gap-3">
                  <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                    {obs.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {obs.childName}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />{obs.staffName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(obs.observationDate.length === 10 ? obs.observationDate + "T00:00:00" : obs.observationDate), "dd/MM/yyyy")}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                    <Clock className="h-3 w-3" />
                    <span>Last edited {format(new Date(obs.updatedAt), "dd/MM/yyyy, h:mm a")}</span>
                  </div>

                  {obs.actionNotes && (
                    <div className="text-xs bg-primary/5 border border-primary/20 rounded px-2.5 py-1.5 text-primary">
                      Action notes recorded
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
