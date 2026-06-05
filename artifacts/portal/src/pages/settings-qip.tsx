import { useState } from "react";
import {
  useListQipSources, useCreateQipSource, useDeleteQipSource,
  useListNqsElements, useUpdateNqsElement, useDeleteNqsElement,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag, Trash2, Pencil, Check, X, ListTree } from "lucide-react";

const QA_LABELS: Record<string, string> = {
  "1": "QA1 — Educational Program and Practice",
  "2": "QA2 — Children's Health and Safety",
  "3": "QA3 — Physical Environment",
  "4": "QA4 — Staffing Arrangements",
  "5": "QA5 — Relationships with Children",
  "6": "QA6 — Collaborative Partnerships",
  "7": "QA7 — Governance and Leadership",
};

function ElementsTab() {
  const queryClient = useQueryClient();
  const { data: elements, isLoading } = useListNqsElements();
  const updateMutation = useUpdateNqsElement();
  const deleteMutation = useDeleteNqsElement();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; code: string; label: string } | null>(null);

  function startEdit(id: number, label: string) {
    setEditingId(id);
    setEditValue(label);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  function saveEdit(id: number) {
    if (!editValue.trim()) return;
    updateMutation.mutate(
      { id, data: { label: editValue.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/nqs-elements"] });
          setEditingId(null);
          toast({ title: "Element updated" });
        },
        onError: () => toast({ title: "Failed to update element", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/nqs-elements"] });
        setDeleteConfirm(null);
        toast({ title: "Element deleted" });
      },
      onError: () => toast({ title: "Failed to delete element", variant: "destructive" }),
    });
  }

  if (isLoading) return <div className="text-muted-foreground text-sm py-4">Loading elements…</div>;
  if (!elements || elements.length === 0) return <div className="text-muted-foreground text-sm py-4">No elements found.</div>;

  const grouped = elements.reduce<Record<string, typeof elements>>((acc, el) => {
    const qa = el.code.split(".")[0];
    if (!acc[qa]) acc[qa] = [];
    acc[qa].push(el);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-amber-50 border-amber-200 px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> The concept name (middle column) can be edited and will update the Add QIP Item dropdown. The element code and descriptor are fixed NQS reference text.
        {isAdmin && <span className="ml-1">Admins can also delete elements — deleted elements can be re-seeded by removing all elements and reloading.</span>}
      </div>

      {Object.entries(grouped).map(([qa, items]) => (
        <div key={qa}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {QA_LABELS[qa] ?? `Quality Area ${qa}`}
          </h3>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-16">Code</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-52">Concept</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Descriptor</th>
                  <th className={isAdmin ? "w-16" : "w-8"}></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((el) => (
                  <tr
                    key={el.id}
                    className={`${el.isHeader ? "bg-muted/30" : "hover:bg-muted/10"} transition-colors align-top group`}
                  >
                    <td className="px-3 py-2.5">
                      <code className={`text-xs font-mono ${el.isHeader ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {el.code}
                      </code>
                    </td>

                    <td className="px-3 py-2.5">
                      {editingId === el.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(el.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="h-7 text-xs"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-primary" onClick={() => saveEdit(el.id)} disabled={updateMutation.isPending}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={cancelEdit}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className={`text-sm ${el.isHeader ? "font-semibold" : ""}`}>{el.label}</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {el.descriptor ?? <span className="italic">—</span>}
                      </span>
                    </td>

                    <td className="px-2 py-2 text-right">
                      {editingId !== el.id && (
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(el.id, el.label)}
                            title="Edit concept name"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteConfirm({ id: el.id, code: el.code, label: el.label })}
                              title="Delete element"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete element?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <code className="text-xs bg-muted px-1 py-0.5 rounded">{deleteConfirm?.code}</code> — <strong>{deleteConfirm?.label}</strong>?
            This will remove it from the NQS element dropdown in QIP items. Existing QIP items that reference this element will not be affected.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm.id)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourcesTab() {
  const queryClient = useQueryClient();
  const { data: sources, isLoading } = useListQipSources();
  const createMutation = useCreateQipSource();
  const deleteMutation = useDeleteQipSource();
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({ data: { name: newName.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/qip-sources"] });
        setNewName("");
        toast({ title: "Source added" });
      },
      onError: () => toast({ title: "Failed to add source", variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/qip-sources"] });
        setDeleteConfirm(null);
        toast({ title: "Source deleted" });
      },
      onError: () => toast({ title: "Failed to delete source", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-5 pb-4">
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New source name… e.g. Family Feedback"
              className="flex-1"
            />
            <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />Add Source
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : !sources || sources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Tag className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No sources yet</h3>
            <p className="text-sm text-muted-foreground">Add your first source above to make it available in QIP items.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border divide-y">
          {sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2.5">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">{source.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteConfirm(source.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete source?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the source from the list. Existing QIP items that use this source will not be affected.</p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsQip() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">QIP Settings</h1>
        <p className="text-muted-foreground mt-1">Manage NQS elements and the sources available when creating QIP improvement items.</p>
      </div>

      <Tabs defaultValue="elements">
        <TabsList>
          <TabsTrigger value="elements" className="gap-2">
            <ListTree className="h-4 w-4" />NQS Elements
          </TabsTrigger>
          <TabsTrigger value="sources" className="gap-2">
            <Tag className="h-4 w-4" />Sources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="elements" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">NQS Elements</CardTitle>
              <p className="text-sm text-muted-foreground">
                Edit the label for any element. Changes take effect immediately in the Add QIP Item form.
              </p>
            </CardHeader>
            <CardContent>
              <ElementsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="mt-6">
          <SourcesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
