import { useListObservations, useListSites } from "@workspace/api-client-react";
import { useActiveChildren } from "@/hooks/use-active-children";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Calendar, User, Clock, MessageCircle, FileEdit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fmtMelb } from "@/lib/timezone";
import { useState, useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";

export default function ObservationsList() {
  const { isEducatorRole, ownSiteId } = usePermissions();
  const { data: observations, isLoading: loadingObservations } = useListObservations();
  const childrenQuery = useActiveChildren();
  const { data: children } = childrenQuery;
  const isLoading = loadingObservations || childrenQuery.isLoading;
  const { data: sites } = useListSites();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all");

  const childSiteMap = useMemo(
    () => new Map((children ?? []).map((c) => [c.id, c.siteId ?? null])),
    [children],
  );

  const showSiteFilter = !isEducatorRole && (sites ?? []).length > 1;

  const matchesFilters = (obs: NonNullable<typeof observations>[number]) => {
    if (!childSiteMap.has(obs.childId)) return false;
    // Educators are always scoped to their own site
    if (isEducatorRole && ownSiteId) {
      const childSite = childSiteMap.get(obs.childId);
      if (childSite !== undefined && childSite !== ownSiteId) return false;
    }

    // Site filter dropdown (admins/EL/coordinators)
    if (!isEducatorRole && siteFilter !== "all") {
      const childSite = childSiteMap.get(obs.childId);
      if (childSite !== parseInt(siteFilter)) return false;
    }

    const q = search.toLowerCase();
    return (
      obs.description.toLowerCase().includes(q) ||
      obs.childName?.toLowerCase().includes(q) ||
      obs.staffName?.toLowerCase().includes(q)
    );
  };

  const draftObservations = observations?.filter((obs) => !obs.publishedAt && matchesFilters(obs));
  const filteredObs = observations?.filter((obs) => obs.publishedAt && matchesFilters(obs));

  function observationDate(value: string) {
    return new Date(value.length === 10 ? `${value}T00:00:00` : value);
  }

  if (childrenQuery.isError) return <div role="alert" className="text-destructive">Active children could not be loaded. <Button variant="link" onClick={() => void childrenQuery.refetch()}>Retry</Button></div>;

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by child, educator or observation..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {showSiteFilter && (
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-48 bg-card">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {(sites ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!isLoading && (draftObservations?.length ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 space-y-3">
            <div>
              <h2 className="font-semibold">Saved drafts</h2>
              <p className="text-sm text-muted-foreground">Continue working on these observations before publishing.</p>
            </div>
            <div className="divide-y rounded-md border bg-card">
              {draftObservations?.map((obs) => (
                <div key={obs.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileEdit className="h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{obs.childName || "Observation draft"}</span>
                    <span className="text-muted-foreground">
                      {obs.staffName ? ` · ${obs.staffName}` : ""}
                      {obs.observationDate ? ` · ${format(observationDate(obs.observationDate), "dd/MM/yyyy")}` : ""}
                    </span>
                    {obs.description && <span className="ml-2 text-muted-foreground">— {obs.description}</span>}
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/observations/${obs.id}/edit`}>Continue</Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                        {format(observationDate(obs.observationDate), "dd/MM/yyyy")}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                    <Clock className="h-3 w-3" />
                    <span>Last edited {fmtMelb(obs.updatedAt, "dd/MM/yyyy, h:mm a")}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {obs.actionNotes && (
                      <div className="text-xs bg-primary/5 border border-primary/20 rounded px-2.5 py-1.5 text-primary">
                        Action notes recorded
                      </div>
                    )}
                    {(obs.commentCount ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>{obs.commentCount}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
