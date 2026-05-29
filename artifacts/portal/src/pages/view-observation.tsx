import { useState } from "react";
import { useGetObservation, getGetObservationQueryKey, useUpdateObservation, useDeleteObservation, useListStaff, getListObservationsQueryKey } from "@workspace/api-client-react";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ArrowLeft, User, Calendar, Trash2, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MtopOutcomePicker } from "@/components/mtop-outcome-picker";
import { bubbleClassForSub, dotClassForSub } from "@/components/read-only-plan-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ViewObservation() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: obs, isLoading } = useGetObservation(id, { query: { queryKey: getGetObservationQueryKey(id), enabled: !!id } });
  const { data: staff } = useListStaff();
  const deleteObs = useDeleteObservation();
  const updateObs = useUpdateObservation();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    staffId: "",
    observationDate: "",
    description: "",
    commentPlan: "",
    actionNotes: "",
  });
  const [editOutcomeIds, setEditOutcomeIds] = useState<string[]>([]);

  function openEdit() {
    if (!obs) return;
    setEditForm({
      staffId: String(obs.staffId),
      observationDate: format(new Date(obs.observationDate as unknown as string), "yyyy-MM-dd"),
      description: obs.description,
      commentPlan: obs.commentPlan ?? "",
      actionNotes: obs.actionNotes ?? "",
    });
    setEditOutcomeIds(obs.outcomeIds ?? []);
    setEditOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      staffId: parseInt(editForm.staffId),
      observationDate: editForm.observationDate,
      description: editForm.description,
      outcomeIds: editOutcomeIds,
      commentPlan: editForm.commentPlan || undefined,
      actionNotes: editForm.actionNotes || undefined,
    };
    updateObs.mutate(
      { id, data: body as any },
      {
        onSuccess: () => {
          setEditOpen(false);
          queryClient.invalidateQueries({ queryKey: [`/api/observations/${id}`] });
          queryClient.invalidateQueries({ queryKey: getListObservationsQueryKey() });
          toast({ title: "Observation updated" });
        },
        onError: () => toast({ title: "Failed to update observation", variant: "destructive" }),
      }
    );
  }

  const handleDelete = () => {
    deleteObs.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListObservationsQueryKey() });
          toast({ title: "Observation deleted" });
          setLocation("/observations");
        },
        onError: () => toast({ title: "Failed to delete observation", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!obs) {
    return <div className="max-w-3xl mx-auto text-muted-foreground py-12 text-center">Observation not found</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Observation</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-1.5" />Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete observation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this observation record. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {format(new Date(obs.observationDate.length === 10 ? obs.observationDate + "T00:00:00" : obs.observationDate), "dd/MM/yyyy")}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {obs.staffName ?? "Unknown educator"}
            </span>
            {obs.childName && (
              <Link href={`/children/${obs.childId}`}>
                <span className="text-primary hover:underline cursor-pointer font-medium">{obs.childName}</span>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {(obs.outcomeIds ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">MTOP Outcomes</p>
              <div className="flex flex-wrap gap-1.5">
                {(obs.outcomeIds ?? []).map((subId) => (
                  <span
                    key={subId}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${bubbleClassForSub(subId)}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClassForSub(subId)}`} />
                    {subId}
                  </span>
                ))}
              </div>
              <Separator />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observation</p>
            <p className="whitespace-pre-wrap leading-relaxed">{obs.description}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comment / Plan</p>
            {obs.commentPlan ? (
              <p className="whitespace-pre-wrap leading-relaxed">{obs.commentPlan}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No comment or plan recorded.</p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action Notes</p>
            {obs.actionNotes ? (
              <p className="whitespace-pre-wrap leading-relaxed">{obs.actionNotes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No action notes recorded.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Observation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-1.5">
              <Label>MTOP Outcomes</Label>
              <MtopOutcomePicker value={editOutcomeIds} onChange={setEditOutcomeIds} label="MTOP Outcomes" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Educator</Label>
                <Select value={editForm.staffId} onValueChange={(v) => setEditForm((f) => ({ ...f, staffId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select educator" /></SelectTrigger>
                  <SelectContent>
                    {staff?.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editForm.observationDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, observationDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observation</Label>
              <Textarea
                rows={5}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Comment / Plan</Label>
              <Textarea
                rows={3}
                value={editForm.commentPlan}
                onChange={(e) => setEditForm((f) => ({ ...f, commentPlan: e.target.value }))}
                placeholder="Educator's analysis and planned next steps..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Action Notes</Label>
              <Textarea
                rows={3}
                value={editForm.actionNotes}
                onChange={(e) => setEditForm((f) => ({ ...f, actionNotes: e.target.value }))}
                placeholder="Actions taken or follow-up steps completed..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateObs.isPending}>
                {updateObs.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
