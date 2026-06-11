import { useState } from "react";
import { useListSites, useCreateSite, useUpdateSite, useDeleteSite, getListSitesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MapPin, Pencil, Trash2, Building2, ChevronRight, FileText } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

type SiteForm = { name: string; address: string };
const EMPTY: SiteForm = { name: "", address: "" };

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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(e: React.MouseEvent, site: { id: number; name: string; address?: string | null }) {
    e.stopPropagation();
    setEditing(site.id);
    setForm({ name: site.name, address: site.address ?? "" });
    setOpen(true);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListSitesQueryKey() });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name: form.name.trim(), address: form.address.trim() || undefined };
    if (editing !== null) {
      updateSite.mutate(
        { id: editing, data },
        {
          onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Site updated" }); },
          onError: () => toast({ title: "Failed to update site", variant: "destructive" }),
        }
      );
    } else {
      createSite.mutate(
        { data: { name: data.name, address: data.address } },
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card
              key={site.id}
              className="group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => setLocation(`/sites/${site.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <h3 className="font-semibold leading-snug">{site.name}</h3>
                  </div>
                  {isAdminOrEL && (
                    <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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

                {site.address && (
                  <div className="flex items-start gap-1.5 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{site.address}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-sm text-primary font-medium mt-auto">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Site Instructions</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </div>
              </CardContent>
            </Card>
          ))}
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
