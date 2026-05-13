import { useListGuardians, useListSites } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Mail, Phone, Users, ShieldCheck, ShieldOff,
  LayoutGrid, List, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "tiles" | "list";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function firstLetter(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "#";
}

export default function GuardiansList() {
  const { data: guardians, isLoading } = useListGuardians();
  const { data: sites } = useListSites();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");
  const [view, setView] = useState<ViewMode>("tiles");

  const filtered = [...(guardians ?? [])]
    .sort((a, b) => a.guardianName.localeCompare(b.guardianName))
    .filter((g) => {
      const q = search.toLowerCase();
      const matchesSearch =
        g.guardianName.toLowerCase().includes(q) ||
        g.guardianEmail.toLowerCase().includes(q) ||
        g.childNames.some((n) => n.toLowerCase().includes(q));

      const matchesSite =
        siteFilter === "all" ? true
        : siteFilter === "none" ? g.siteIds.length === 0
        : g.siteIds.includes(parseInt(siteFilter));

      return matchesSearch && matchesSite;
    });

  // Group for list view
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, g) => {
    const letter = firstLetter(g.guardianName);
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(g);
    return acc;
  }, {});
  const sortedLetters = Object.keys(grouped).sort();

  const loadingSkeletons = view === "tiles"
    ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
    : <div className="space-y-1">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;

  const showSiteFilter = sites && sites.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guardians</h1>
          <p className="text-muted-foreground mt-1">
            Parent and guardian accounts linked to enrolled children.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or child..."
            className="pl-9 w-64 bg-card"
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
              <SelectItem value="none">No site assigned</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* View toggle */}
        <div className="flex rounded-md border border-input bg-card overflow-hidden text-sm ml-auto shrink-0">
          <button
            onClick={() => setView("tiles")}
            className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${view === "tiles" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Tiles</span>
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? loadingSkeletons : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            {search || siteFilter !== "all"
              ? "No guardians match your filters."
              : "No guardians found. Enrol children to see their guardians here."}
          </p>
        </div>
      ) : view === "tiles" ? (
        /* ── TILE VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => {
            const guardianSites = (sites ?? []).filter((s) => g.siteIds.includes(s.id));
            return (
              <Link key={g.guardianEmail} href={`/guardians/${encodeURIComponent(g.guardianEmail)}`}>
                <div className="bg-card border rounded-xl p-5 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer h-full flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base font-bold shrink-0">
                      {initials(g.guardianName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">{g.guardianName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <Mail className="h-3 w-3 shrink-0" />{g.guardianEmail}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 shrink-0" />{g.guardianPhone}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {g.childNames.map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                    ))}
                  </div>

                  <div className="mt-auto space-y-1.5">
                    {guardianSites.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {guardianSites.map((s) => s.name).join(", ")}
                      </p>
                    )}
                    <div>
                      {g.hasPassword ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <ShieldCheck className="h-3.5 w-3.5" />Account active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ShieldOff className="h-3.5 w-3.5" />No account set up
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="space-y-6">
          {sortedLetters.map((letter) => (
            <div key={letter}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-bold text-primary w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  {letter}
                </span>
                <div className="flex-1 border-t border-border" />
              </div>

              <div className="border rounded-xl overflow-hidden divide-y divide-border">
                {grouped[letter].map((g) => {
                  const guardianSites = (sites ?? []).filter((s) => g.siteIds.includes(s.id));
                  return (
                    <Link key={g.guardianEmail} href={`/guardians/${encodeURIComponent(g.guardianEmail)}`}>
                      <div className="flex items-center gap-4 px-5 py-4 bg-card hover:bg-muted/50 transition-colors cursor-pointer w-full">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {initials(g.guardianName)}
                        </div>

                        <div className="w-44 shrink-0">
                          <p className="font-semibold text-sm truncate">{g.guardianName}</p>
                          {guardianSites.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {guardianSites.map((s) => s.name).join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="hidden md:flex flex-col gap-0.5 w-52 shrink-0">
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3 shrink-0" />{g.guardianEmail}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0" />{g.guardianPhone}
                          </p>
                        </div>

                        <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                          {g.childNames.map((name, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                          ))}
                        </div>

                        <div className="hidden sm:flex shrink-0">
                          {g.hasPassword ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 whitespace-nowrap">
                              <ShieldCheck className="h-3.5 w-3.5" />Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                              <ShieldOff className="h-3.5 w-3.5" />No account
                            </span>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
