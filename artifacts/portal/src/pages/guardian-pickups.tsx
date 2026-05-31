import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, Plus, Trash2, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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

function PickupsForChild({ child }: { child: Child }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const pickups: ApprovedPickup[] = (child.approvedPickups as ApprovedPickup[]) ?? [];

  const saveMutation = useMutation({
    mutationFn: async (next: ApprovedPickup[]) => {
      const res = await fetch(`/api/auth/my-children/${child.id}/pickups`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-children"] });
      toast({ title: "Saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  function handleAdd() {
    if (!form.fullName.trim()) return;
    const next = [...pickups, { id: randomId(), ...form }];
    saveMutation.mutate(next, {
      onSuccess: () => { setForm(EMPTY_FORM); setAdding(false); },
    });
  }

  function handleRemove(id: string) {
    saveMutation.mutate(pickups.filter((p) => p.id !== id));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{child.firstName} {child.lastName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pickups.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground italic">No approved pick-ups recorded yet.</p>
        )}
        {pickups.map((p, i) => (
          <div key={p.id} className="flex items-start justify-between gap-3 text-sm border rounded-lg p-3">
            <div>
              <p className="font-medium">Pick Up {i + 1} — {p.fullName}</p>
              <p className="text-muted-foreground">{p.relationship}</p>
              <p className="text-muted-foreground">{p.phone}</p>
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
            <p className="text-sm font-medium">New Pick Up {pickups.length + 1}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="04xx xxx xxx" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Relationship to Child</Label>
                <Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="Aunt, Uncle, Grandparent…" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!form.fullName.trim() || saveMutation.isPending}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setForm(EMPTY_FORM); }}>Cancel</Button>
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
  );
}

export default function GuardianPickups() {
  const { data: children, isLoading } = useQuery<Child[]>({
    queryKey: ["/api/auth/my-children"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-children");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-muted-foreground" />
          Approved Pick-Ups
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          People you have authorised to collect your child from the centre.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
      ) : !children || children.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mb-3 opacity-25" />
            <p className="font-medium">No children linked</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {children.map((child) => <PickupsForChild key={child.id} child={child} />)}
        </div>
      )}
    </div>
  );
}
