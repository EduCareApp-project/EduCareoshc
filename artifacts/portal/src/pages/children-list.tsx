import { useListChildren, useListSites, useGetChildSettings, getGetChildSettingsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { format, differenceInYears, differenceInMonths } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";

function calcAge(dob: string) {
  const birth = new Date(dob.length === 10 ? dob + "T00:00:00" : dob);
  const now = new Date();
  const years = differenceInYears(now, birth);
  if (years < 1) {
    const months = differenceInMonths(now, birth);
    return `${months} month${months !== 1 ? "s" : ""}`;
  }
  return `${years} year${years !== 1 ? "s" : ""}`;
}

function storageUrl(objectPath: string): string {
  const id = objectPath.replace(/^\/objects\//, "");
  return `/api/storage/objects/${id}`;
}

type ViewMode = "tiles" | "list";

function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [view, setViewState] = useState<ViewMode>(() => {
    try { return (localStorage.getItem("children-view") as ViewMode) ?? "tiles"; }
    catch { return "tiles"; }
  });
  function setView(v: ViewMode) {
    setViewState(v);
    try { localStorage.setItem("children-view", v); } catch {}
  }
  return [view, setView];
}

export default function ChildrenList() {
  const { isEducatorRole, ownSiteId } = usePermissions();
  const { data: children, isLoading } = useListChildren();
  const { data: sites } = useListSites();
  const { data: childSettings } = useGetChildSettings({ query: { queryKey: getGetChildSettingsQueryKey() } });
  const showPhoto = childSettings?.childDisplayMode === "profile_picture";
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState(() =>
    isEducatorRole && ownSiteId ? String(ownSiteId) : "all"
  );
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [view, setView] = useViewMode();

  const filteredChildren = children?.filter(c => {
    const matchesSearch = c.firstName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastName.toLowerCase().includes(search.toLowerCase());
    const matchesSite = siteFilter === "all"
      ? true
      : siteFilter === "none"
        ? c.siteId == null
        : c.siteId === parseInt(siteFilter);
    const matchesStatus = statusFilter === "all" ? true : c.status === statusFilter;
    return matchesSearch && matchesSite && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Children</h1>
          <p className="text-muted-foreground mt-1">Manage enrolled children and their profiles.</p>
        </div>
        <Link href="/children/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Enroll Child
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            className="pl-9 w-64 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {sites && sites.length > 0 && (
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-48 bg-card">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              <SelectItem value="none">No site assigned</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex rounded-md border border-input bg-card overflow-hidden text-sm">
          {(["active", "inactive", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 capitalize transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex rounded-md border border-input bg-card overflow-hidden ml-auto">
          <button
            onClick={() => setView("tiles")}
            title="Tile view"
            className={`p-2 transition-colors ${view === "tiles" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
            title="List view"
            className={`p-2 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        view === "tiles" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 h-32 bg-muted/20" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-14 rounded-lg border bg-card animate-pulse bg-muted/20" />
            ))}
          </div>
        )
      ) : filteredChildren?.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-dashed">
          <BabyIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-1">No children found</h3>
          <p className="text-muted-foreground">Get started by enrolling a new child.</p>
        </div>
      ) : view === "tiles" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChildren?.map((child) => (
            <Link key={child.id} href={`/children/${child.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {showPhoto && child.profilePicturePath ? (
                      <img
                        src={storageUrl(child.profilePicturePath)}
                        alt={`${child.firstName} ${child.lastName}`}
                        className="h-10 w-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0 select-none">
                        {child.firstName[0]}{child.lastName[0]}
                      </div>
                    )}
                    <CardTitle className="text-lg leading-tight">{child.firstName} {child.lastName}</CardTitle>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    <Badge variant={child.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {child.status}
                    </Badge>
                    {child.hasMedicalCondition && (child.communicationPlan as any)?.medicalCondition && (
                      <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
                        {(child.communicationPlan as any).medicalCondition}
                      </Badge>
                    )}
                    {child.photoRestriction && (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-800 bg-amber-50">
                        No Photo
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date of Birth</span>
                      <span className="font-medium">{format(new Date(child.dateOfBirth.length === 10 ? child.dateOfBirth + "T00:00:00" : child.dateOfBirth), "dd/MM/yyyy")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guardian</span>
                      <span className="font-medium truncate ml-4">{child.guardianName}</span>
                    </div>
                    {child.siteId && sites && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Site</span>
                        <span className="font-medium truncate ml-4">{sites.find(s => s.id === child.siteId)?.name ?? "—"}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center px-4 py-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="w-8" />
            <span>Name</span>
            <span className="w-28 text-right hidden sm:block">Age</span>
            <span className="w-32 text-right hidden md:block">Site</span>
            <span className="w-20 text-right">Status</span>
          </div>
          <div className="divide-y">
            {filteredChildren?.map((child) => {
              const siteName = child.siteId && sites ? (sites.find(s => s.id === child.siteId)?.name ?? null) : null;
              const age = calcAge(child.dateOfBirth);
              return (
                <Link key={child.id} href={`/children/${child.id}`}>
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    {showPhoto && child.profilePicturePath ? (
                      <img
                        src={storageUrl(child.profilePicturePath)}
                        alt={`${child.firstName} ${child.lastName}`}
                        className="h-8 w-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 select-none">
                        {child.firstName[0]}{child.lastName[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{child.firstName} {child.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{child.guardianName}</p>
                      {(child.hasMedicalCondition || child.photoRestriction) && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {child.hasMedicalCondition && (child.communicationPlan as any)?.medicalCondition && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-red-300 text-red-700 bg-red-50">
                              {(child.communicationPlan as any).medicalCondition}
                            </Badge>
                          )}
                          {child.photoRestriction && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-300 text-amber-800 bg-amber-50">
                              No Photo
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="w-28 text-right text-sm text-muted-foreground hidden sm:block">{age}</span>
                    <span className="w-32 text-right text-sm text-muted-foreground truncate hidden md:block">{siteName ?? "—"}</span>
                    <Badge variant={child.status === 'active' ? 'default' : 'secondary'} className="capitalize w-20 justify-center text-xs">
                      {child.status}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BabyIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
      <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 1.5-2.5 1.5c-2.5 0-3.5 1.5-3.5 2.5 0 .8 1.2 1.5 2.5 1.5 1.5 0 2.5 1 2.5 2" />
    </svg>
  );
}
