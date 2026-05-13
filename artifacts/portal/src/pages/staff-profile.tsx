import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetStaff, useGetStaffProfessionalDevelopment, useCreateProfessionalDevelopment, useDeleteProfessionalDevelopment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, GraduationCap, User } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<string, string> = { director: "Director", educator: "Educator", assistant: "Assistant", trainee: "Trainee" };

export default function StaffProfile() {
  const { id } = useParams<{ id: string }>();
  const staffId = parseInt(id ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: staff, isLoading: loadingStaff } = useGetStaff(staffId, { query: { enabled: !!staffId } });
  const { data: pdList, isLoading: loadingPd } = useGetStaffProfessionalDevelopment(staffId, { query: { enabled: !!staffId } });
  const createPdMutation = useCreateProfessionalDevelopment();
  const deletePdMutation = useDeleteProfessionalDevelopment();

  const [pdOpen, setPdOpen] = useState(false);
  const [pdForm, setPdForm] = useState({ title: "", provider: "", completedAt: "", hoursEarned: "", notes: "" });

  function handleCreatePd(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { staffId, title: pdForm.title, completedAt: pdForm.completedAt };
    if (pdForm.provider) data.provider = pdForm.provider;
    if (pdForm.hoursEarned) data.hoursEarned = parseInt(pdForm.hoursEarned);
    if (pdForm.notes) data.notes = pdForm.notes;
    createPdMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setPdOpen(false);
        setPdForm({ title: "", provider: "", completedAt: "", hoursEarned: "", notes: "" });
        queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/professional-development`] });
        toast({ title: "PD entry added" });
      },
      onError: () => toast({ title: "Failed to add PD entry", variant: "destructive" }),
    });
  }

  function handleDeletePd(pdId: number) {
    deletePdMutation.mutate({ id: pdId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/professional-development`] }),
    });
  }

  const currentYear = new Date().getFullYear();
  const pdThisYear = (pdList ?? []).filter((p) => new Date(p.completedAt + "T00:00:00").getFullYear() === currentYear);
  const totalHoursThisYear = pdThisYear.reduce((s, p) => s + (p.hoursEarned ?? 0), 0);

  if (loadingStaff) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!staff) {
    return <div className="text-center py-12 text-muted-foreground">Staff member not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/staff">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back to Staff</Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{staff.firstName} {staff.lastName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{ROLE_LABELS[staff.role] || staff.role}</Badge>
            <Badge variant={staff.status === "active" ? "default" : "secondary"}>{staff.status}</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="pd">Professional Development</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs text-muted-foreground mb-1">Email</p><p className="font-medium">{staff.email}</p></div>
                {staff.phone && <div><p className="text-xs text-muted-foreground mb-1">Phone</p><p className="font-medium">{staff.phone}</p></div>}
                <div><p className="text-xs text-muted-foreground mb-1">Qualifications</p><p className="font-medium">{staff.qualifications}</p></div>
                <div><p className="text-xs text-muted-foreground mb-1">WWCC Number</p>
                  <p className={`font-medium ${!staff.wwccNumber ? "text-amber-600" : ""}`}>{staff.wwccNumber || "Not on file"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pd" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-primary">{totalHoursThisYear}h</p>
                <p className="text-xs text-muted-foreground">PD hours in {currentYear}</p>
              </div>
              {totalHoursThisYear >= 8
                ? <Badge className="bg-green-100 text-green-800">Meeting requirements</Badge>
                : <Badge className="bg-amber-100 text-amber-800">{8 - totalHoursThisYear}h remaining</Badge>}
            </div>
            <Dialog open={pdOpen} onOpenChange={setPdOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add PD</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Professional Development</DialogTitle></DialogHeader>
                <form onSubmit={handleCreatePd} className="space-y-4">
                  <div className="space-y-1"><Label>Title / Course Name</Label><Input value={pdForm.title} onChange={(e) => setPdForm({ ...pdForm, title: e.target.value })} required /></div>
                  <div className="space-y-1"><Label>Provider</Label><Input value={pdForm.provider} onChange={(e) => setPdForm({ ...pdForm, provider: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Completion Date</Label><Input type="date" value={pdForm.completedAt} onChange={(e) => setPdForm({ ...pdForm, completedAt: e.target.value })} required /></div>
                    <div className="space-y-1"><Label>Hours Earned</Label><Input type="number" min="0" value={pdForm.hoursEarned} onChange={(e) => setPdForm({ ...pdForm, hoursEarned: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1"><Label>Notes</Label><Textarea value={pdForm.notes} onChange={(e) => setPdForm({ ...pdForm, notes: e.target.value })} rows={3} /></div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setPdOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createPdMutation.isPending}>Add Entry</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingPd ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (pdList ?? []).length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
              <GraduationCap className="h-8 w-8 mb-2" />
              <p>No professional development entries yet.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {[...(pdList ?? [])].reverse().map((p) => (
                <Card key={p.id}>
                  <CardContent className="py-3 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{p.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{format(new Date(p.completedAt + "T00:00:00"), "MMM d, yyyy")}</span>
                        {p.provider && <><span>•</span><span>{p.provider}</span></>}
                        {p.hoursEarned != null && <><span>•</span><span className="font-medium text-foreground/70">{p.hoursEarned}h</span></>}
                      </div>
                      {p.notes && <p className="text-xs text-muted-foreground italic mt-1">{p.notes}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeletePd(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
