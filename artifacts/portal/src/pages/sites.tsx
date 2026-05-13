import { useState } from "react";
import { useListSites, useCreateSite, useUpdateSite, useDeleteSite, getListSitesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Pencil, Trash2, Building2 } from "lucide-react";

type SiteForm = { name: string; address: string };
const EMPTY: SiteForm = { name: "", address: "" };

export default function Sites() {
  const { data: sites, isLoading } = useListSites();
  const queryClient = useQueryClient();
  const { toast } = useToast();
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

  function openEdit(site: { id: number; name: string; address?: string | null }) {
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
          onSuccess: () => {
            invalidate();
            setOpen(false);
            toast({ title: "Site updated" });
          },
          onError: () => toast({ title: "Failed to update site", variant: "destructive" }),
        }
      );
    } else {
      createSite.mutate(
        { data: { name: data.name, address: data.address } },
        {
          onSuccess: () => {
            invalidate();
            setOpen(false);
            toast({ title: "Site created" });
          },
          onError: () => toast({ title: "Failed to create site", variant: "destructive" }),
        }
      );
    }
  }

  function handleDelete(id: number) {
    deleteSite.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          setDeleteConfirm(null);
          toast({ title: "Site deleted" });
        },
        onError: () => toast({ title: "Failed to delete site", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sites</h1>
          <p className="text-muted-foreground mt-1">Manage the locations your service operates from.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />Add Site
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !sites || sites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No sites yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first site to start categorising children by location.</p>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Site</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card key={site.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-5 w-5 text-primary shrink-0" />
                    <CardTitle className="text-base leading-tight">{site.name}</CardTitle>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(site)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(site.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {site.address && (
                <CardContent className="pt-0">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{site.address}</span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

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

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete site?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the site. Children assigned to it will become unassigned. This cannot be undone.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)} disabled={deleteSite.isPending}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
