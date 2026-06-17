import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, Plus, Trash2, ClipboardList, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ApprovedPickup { id: string; fullName: string; phone: string; relationship: string; }
interface Child {
  id: number;
  firstName: string;
  lastName: string;
  approvedPickups?: ApprovedPickup[] | null;
}

function randomId() { return Math.random().toString(36).slice(2); }

const EMPTY_FORM = { fullName: "", phone: "", relationship: "" };

async function savePickupsForChild(childId: number, pickups: ApprovedPickup[]) {
  const res = await fetch(`/api/auth/my-children/${childId}/pickups`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pickups),
  });
  if (!res.ok) throw new Error("Failed");
}

export default function GuardianPickups() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: children, isLoading } = useQuery<Child[]>({
    queryKey: ["/api/auth/my-children"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-children");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // Build a merged, deduplicated pickup list across all children (dedup by id).
  // If the same person (same id) exists on multiple children they appear once.
  const mergedPickups: ApprovedPickup[] = [];
  const seen = new Set<string>();
  for (const child of children ?? []) {
    for (const p of child.approvedPickups ?? []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        mergedPickups.push(p);
      }
    }
  }

  const saveMutation = useMutation({
    mutationFn: async ({ next }: { next: ApprovedPickup[] }) => {
      if (!children) return;
      await Promise.all(children.map((child) => {
        // Keep child-specific pickups that aren't in the merged list (edge case),
        // then replace with the new merged list.
        return savePickupsForChild(child.id, next);
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-children"] });
      toast({ title: "Saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  function handleAdd() {
    if (!form.fullName.trim()) return;
    const newEntry = { id: randomId(), ...form };
    const next = [...mergedPickups, newEntry];
    saveMutation.mutate({ next }, {
      onSuccess: () => { setForm(EMPTY_FORM); setAdding(false); },
    });
  }

  function handleRemove(id: string) {
    saveMutation.mutate({ next: mergedPickups.filter((p) => p.id !== id) });
  }

  const childCount = children?.length ?? 0;
  const multipleChildren = childCount > 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-muted-foreground" />
          Approved Pick-Ups
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {multipleChildren
            ? "People you have authorised to collect your children from the centre."
            : "People you have authorised to collect your child from the centre."}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : !children || children.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mb-3 opacity-25" />
            <p className="font-medium">No children linked</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Authorised Pick-Up Persons</CardTitle>
              {multipleChildren && (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  <Users className="h-3 w-3" />
                  Applies to all {childCount} children
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {mergedPickups.length === 0 && !adding && (
              <p className="text-sm text-muted-foreground italic">No approved pick-ups recorded yet.</p>
            )}

            {mergedPickups.map((p, i) => (
              <div key={p.id} className="flex items-start justify-between gap-3 text-sm border rounded-lg p-3">
                <div>
                  <p className="font-medium">Pick Up {i + 1} — {p.fullName}</p>
                  {p.relationship && <p className="text-muted-foreground">{p.relationship}</p>}
                  {p.phone && <p className="text-muted-foreground">{p.phone}</p>}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleRemove(p.id)}
                  disabled={saveMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {adding ? (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">
                  New Pick Up {mergedPickups.length + 1}
                  {multipleChildren && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      — will be added for all {childCount} children
                    </span>
                  )}
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Full Name</Label>
                    <Input
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="04xx xxx xxx"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Relationship to Child</Label>
                    <Input
                      value={form.relationship}
                      onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                      placeholder="Aunt, Uncle, Grandparent…"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={!form.fullName.trim() || saveMutation.isPending}
                  >
                    {saveMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setAdding(false); setForm(EMPTY_FORM); }}
                    disabled={saveMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Pick Up
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
