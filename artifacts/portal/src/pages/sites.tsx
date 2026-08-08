import { useState } from "react";
import { useListSites, useCreateSite, useUpdateSite, useDeleteSite, getListSitesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MapPin, Pencil, Trash2, Building2, ChevronRight, FileText, Layers, ChevronDown } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

type SiteStatus = "active" | "pending" | "closed";
type SiteForm = { name: string; address: string; grouping: string; status: SiteStatus; isDoscel: boolean };
const EMPTY: SiteForm = { name: "", address: "", grouping: "", status: "active", isDoscel: false };

function LatinCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <rect x="10.5" y="2" width="3" height="20" />
      <rect x="4" y="7" width="16" height="3" />
    </svg>
  );
}

const STATUS_LABELS: Record<SiteStatus, string> = {
  active: "Active",
  pending: "Pending",
  closed: "Closed",
};

export default function Sites() {
  const { data: sites, isLoading } = useListSites();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAdminOrEL } = usePermissions();
  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const deleteSite = useDeleteSite();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<SiteForm>(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [closedExpanded, setClosedExpanded] = useState(false);

  const existingGroupings = Array.from(
    new Set((sites ?? []).map((s) => s.grouping).filter(Boolean) as string[])
  ).sort();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(e: React.MouseEvent, site: { id: number; name: string; address?: string | null; grouping?: string | null; status?: string; isDoscel?: boolean }) {
    e.stopPropagation();
    setEditing(site.id);
    setForm({
      name: site.name,
      address: site.address ?? "",
      grouping: site.grouping ?? "",
      status: (site.status ?? "active") as SiteStatus,
      isDoscel: site.isDoscel ?? false,
    });
    setOpen(true);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListSitesQueryKey() });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      grouping: form.grouping.trim() || undefined,
      status: form.status,
      isDoscel: form.isDoscel,
    };
    if (editing !== null) {
      updateSite.mutate(
        { id: editing, data: { ...data, grouping: data.grouping ?? null } },
        {
          onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Site updated" }); },
          onError: () => toast({ title: "Failed to update site", variant: "destructive" }),
        }
      );
    } else {
      createSite.mutate(
        { data },
        {
          onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Site created" }); },
          onError: () => toast({ title: "Failed to create site", variant: "destructive" }),
        }
      );
    }
  }

  function handleDelete(id: number) {
    deleteSite.mutate(
      { id },
      {
        onSuccess: () => { invalidate(); setDeleteConfirm(null); toast({ title: "Site deleted" }); },
        onError: () => toast({ title: "Failed to delete site", variant: "destructive" }),
      }
    );
  }

  // Separate closed sites out; sort the rest by grouping then name
  const allSorted = [...(sites ?? [])].sort((a, b) => {
    const ga = a.grouping ?? "";
    const gb = b.grouping ?? "";
    if (ga !== gb) {
      if (!ga) return 1;
      if (!gb) return -1;
      return ga.localeCompare(gb);
    }
    return a.name.localeCompare(b.name);
  });

  const activeSites = allSorted.filter((s) => (s.status ?? "active") !== "closed");
  const closedSites = allSorted.filter((s) => (s.status ?? "active") === "closed");

  // Build grouped sections from an array of sites
  type SiteItem = (typeof allSorted)[number];
  type Group = { label: string | null; items: SiteItem[] };
  function buildGroups(list: SiteItem[]): Group[] {
    const groups: Group[] = [];
    for (const site of list) {
      const g = site.grouping ?? null;
      const last = groups[groups.length - 1];
      if (last && last.label === g) {
        last.items.push(site);
      } else {
        groups.push({ label: g, items: [site] });
      }
    }
    return groups;
  }

  const activeGroups = buildGroups(activeSites);
  const closedGroups = buildGroups(closedSites);
  const hasAnyGrouping = allSorted.some((s) => s.grouping);

  function tileClass(status: string) {
    if (status === "pending") return "bg-blue-50 border-blue-200 hover:border-blue-400 hover:shadow-md";
    return "hover:border-primary/50 hover:shadow-md";
  }

  const SiteCard = ({ site }: { site: SiteItem }) => {
    const status = (site.status ?? "active") as SiteStatus;
    return (
      <Card
        className={`group cursor-pointer transition-all ${tileClass(status)}`}
        onClick={() => setLocation(`/sites/${site.id}`)}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${status === "pending" ? "bg-blue-100" : "bg-primary/10"}`}>
                <Building2 className={`h-4.5 w-4.5 ${status === "pending" ? "text-blue-600" : "text-primary"}`} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug">{site.name}</h3>
                {status !== "active" && (
                  <span className={`text-xs font-medium ${status === "pending" ? "text-blue-600" : "text-muted-foreground"}`}>
                    {STATUS_LABELS[status]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {site.isDoscel && (
                <LatinCross className="h-5 w-5 text-slate-500" />
              )}
              {isAdminOrEL && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={(e) => openEdit(e, site)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(site.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {site.address && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground mb-3">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{site.address}</span>
            </div>
          )}

          <div className={`flex items-center gap-1.5 text-sm font-medium mt-auto ${status === "pending" ? "text-blue-600" : "text-primary"}`}>
            <FileText className="h-3.5 w-3.5" />
            <span>Site Instructions</span>
            <ChevronRight className="h-3.5 w-3.5 ml-auto group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardContent>
      </Card>
    );
  };

  const GroupedGrid = ({ groups, hasAnyGrouping: showHeaders }: { groups: Group[]; hasAnyGrouping: boolean }) => (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.label ?? "__ungrouped"} className="space-y-3">
          {showHeaders && (group.label ? (
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</h2>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Other</h2>
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((site) => <SiteCard key={site.id} site={site} />)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
          <p className="text-muted-foreground mt-1">
            View operational instructions for each service location.
          </p>
        </div>
        {isAdminOrEL && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Add Site
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : !sites || sites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No sites yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isAdminOrEL ? "Add your first site to get started." : "No sites have been configured yet."}
            </p>
            {isAdminOrEL && (
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Site</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Active + Pending sites */}
          {activeSites.length > 0 && (
            <GroupedGrid groups={activeGroups} hasAnyGrouping={hasAnyGrouping} />
          )}

          {/* Closed sites — collapsed by default */}
          {closedSites.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setClosedExpanded((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${closedExpanded ? "rotate-180" : ""}`} />
                Closed sites ({closedSites.length})
              </button>
              {closedExpanded && (
                <GroupedGrid groups={closedGroups} hasAnyGrouping={hasAnyGrouping} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing !== null ? "Edit Site" : "Add Site"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Site Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sunshine Centre North"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. 12 Park Street, Melbourne VIC 3000"
              />
            </div>
            <div className="space-y-1">
              <Label>
                Grouping{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                list="grouping-options"
                value={form.grouping}
                onChange={(e) => setForm({ ...form, grouping: e.target.value })}
                placeholder="e.g. Northern Zone"
              />
              {existingGroupings.length > 0 && (
                <datalist id="grouping-options">
                  {existingGroupings.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              )}
              <p className="text-xs text-muted-foreground">
                Sites with the same grouping are listed together.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as SiteStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <input
                id="isDoscel"
                type="checkbox"
                checked={form.isDoscel}
                onChange={(e) => setForm({ ...form, isDoscel: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
              />
              <div>
                <Label htmlFor="isDoscel" className="cursor-pointer font-medium">DOSCEL School</Label>
                <p className="text-xs text-muted-foreground">Identifies this site as a DOSCEL school.</p>
              </div>
              {form.isDoscel && <LatinCross className="h-5 w-5 text-slate-500 ml-auto shrink-0" />}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createSite.isPending || updateSite.isPending}>
                {editing !== null ? "Save Changes" : "Add Site"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete site?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the site and all associated instructions. Children assigned to it will become unassigned. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)}
              disabled={deleteSite.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
