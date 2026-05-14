import { useState } from "react";
import { useListQipSources, useCreateQipSource, useDeleteQipSource } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Tag, Trash2 } from "lucide-react";

export default function SettingsQip() {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">QIP Settings – Sources</h1>
          <p className="text-muted-foreground mt-1">Manage the sources available when creating QIP improvement items.</p>
        </div>
      </div>

      {/* Add form */}
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

      {/* Sources list */}
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
