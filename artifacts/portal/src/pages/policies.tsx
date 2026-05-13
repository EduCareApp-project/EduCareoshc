import { useState } from "react";
import { useListPolicies, useCreatePolicy, useAcknowledgePolicy, useListStaff } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FolderOpen, Plus, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["Health & Safety", "Educational Program", "Staffing", "Governance", "Family & Community", "Child Protection", "Emergency", "Other"];

export default function Policies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: policies, isLoading } = useListPolicies();
  const { data: staff } = useListStaff();
  const createMutation = useCreatePolicy();
  const acknowledgeMutation = useAcknowledgePolicy();

  const [createOpen, setCreateOpen] = useState(false);
  const [ackOpen, setAckOpen] = useState<number | null>(null);
  const [ackStaffId, setAckStaffId] = useState("");
  const [form, setForm] = useState({ title: "", category: "", description: "", version: "", lastReviewedAt: "", fileUrl: "" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { title: form.title, category: form.category };
    if (form.description) data.description = form.description;
    if (form.version) data.version = form.version;
    if (form.lastReviewedAt) data.lastReviewedAt = form.lastReviewedAt;
    if (form.fileUrl) data.fileUrl = form.fileUrl;
    createMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setCreateOpen(false);
        setForm({ title: "", category: "", description: "", version: "", lastReviewedAt: "", fileUrl: "" });
        queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
        toast({ title: "Policy added" });
      },
      onError: () => toast({ title: "Failed to add policy", variant: "destructive" }),
    });
  }

  function handleAcknowledge() {
    if (!ackOpen || !ackStaffId) return;
    acknowledgeMutation.mutate({ id: ackOpen, data: { staffId: parseInt(ackStaffId) } }, {
      onSuccess: () => {
        setAckOpen(null);
        setAckStaffId("");
        toast({ title: "Policy acknowledged" });
      },
      onError: () => toast({ title: "Failed to acknowledge", variant: "destructive" }),
    });
  }

  const grouped = CATEGORIES.reduce<Record<string, typeof policies>>((acc, cat) => {
    acc[cat] = (policies ?? []).filter((p) => p.category === cat);
    return acc;
  }, {});
  const otherPolicies = (policies ?? []).filter((p) => !CATEGORIES.includes(p.category));
  if (otherPolicies.length) grouped["Other"] = [...(grouped["Other"] ?? []), ...otherPolicies];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Policies & Files</h1>
          <p className="text-muted-foreground mt-1">Service policies, procedures, and staff acknowledgments.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Policy</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Policy</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Version</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. v2.1" /></div>
                <div className="space-y-1"><Label>Last Reviewed</Label><Input type="date" value={form.lastReviewedAt} onChange={(e) => setForm({ ...form, lastReviewedAt: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="space-y-1"><Label>File URL (optional)</Label><Input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://..." /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || !form.category}>Add Policy</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (policies ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <FolderOpen className="h-8 w-8 mb-2" />
          <p>No policies added yet. Add your first policy document.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const catPolicies = grouped[cat] ?? [];
            if (catPolicies.length === 0) return null;
            return (
              <Card key={cat}>
                <CardHeader className="pb-3"><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
                <div className="divide-y">
                  {catPolicies.map((p) => (
                    <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{p.title}</span>
                          {p.version && <Badge variant="outline" className="text-xs">{p.version}</Badge>}
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
                        {p.lastReviewedAt && <p className="text-xs text-muted-foreground mt-0.5">Last reviewed: {format(new Date(p.lastReviewedAt + "T00:00:00"), "MMM d, yyyy")}</p>}
                        {p.fileUrl && <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-0.5 inline-block">View file</a>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setAckOpen(p.id); setAckStaffId(""); }}>
                        <CheckCircle className="h-3 w-3 mr-1" />Acknowledge
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={ackOpen !== null} onOpenChange={(o) => !o && setAckOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Acknowledgment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select the staff member who has read and acknowledged this policy.</p>
            <div className="space-y-1"><Label>Staff Member</Label>
              <Select value={ackStaffId} onValueChange={setAckStaffId}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>{(staff ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAckOpen(null)}>Cancel</Button>
              <Button onClick={handleAcknowledge} disabled={!ackStaffId || acknowledgeMutation.isPending}>Record Acknowledgment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
