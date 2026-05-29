import { useState, useEffect } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { melbourneDateTimeStr, toMelbourneDate, melbourneLocalToUTCISO } from "@/lib/timezone";
import {
  useGetChild, getGetChildQueryKey, useUpdateChild, useDeleteChild,
  useGetChildObservations, getGetChildObservationsQueryKey, useListSites,
  useGetChildWelfareNotes, getGetChildWelfareNotesQueryKey, useCreateWelfareNote, useUpdateWelfareNote, useDeleteWelfareNote,
  useGetChildConfidentialNotes, getGetChildConfidentialNotesQueryKey, useCreateConfidentialNote, useUpdateConfidentialNote, useDeleteConfidentialNote,
  useListStaff, useListJottings, useListPlanningExperiences, useListPosts,
  useListChildDocuments, getListChildDocumentsQueryKey, useCreateChildDocument, useDeleteChildDocument,
  useGetChildSettings, getGetChildSettingsQueryKey,
  useListChildMedications, useUpsertChildMedication,
  useListMedicationLogs, getListMedicationLogsQueryKey,
  useCreateMedicationLog, useDeleteMedicationLog,
  getListChildMedicationsQueryKey,
  useListChildBehaviouralNotifications, useSendBehaviouralNotification, useDeleteBehaviouralNotification,
  getListChildBehaviouralNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { Staff } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { format, differenceInYears, differenceInMonths } from "date-fns";
import {
  ArrowLeft, Edit, Plus, Trash2, User, Users, Phone, Mail, FileText,
  Calendar, Heart, ThumbsDown, Smile, BookOpen, Building2,
  ShieldAlert, AlertTriangle, Paperclip, X, Lock, Pencil, StickyNote, Newspaper,
  Upload, FolderOpen, Pill, ChevronDown, ChevronUp, ClipboardList, MessageSquareWarning,
} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useUpload } from "@workspace/object-storage-web";
import { useToast } from "@/hooks/use-toast";

function storageUrl(objectPath: string): string {
  const id = objectPath.replace(/^\/objects\//, "");
  return `/api/storage/objects/${id}`;
}

function safeDate(value: string, fmt: string) {
  try {
    const d = new Date(value.length === 10 ? value + "T00:00:00" : value);
    if (isNaN(d.getTime())) return value;
    return format(d, fmt);
  } catch {
    return value;
  }
}

const EMPTY_WELFARE_FORM = {
  occurredAt: melbourneDateTimeStr(),
  staffId: "",
  concerns: "",
  riskFactors: "",
  mandatoryReportRequired: false,
  mandatoryReportNotes: "",
  cissThresholdMet: false,
  cissNotes: "",
  fvissThresholdMet: false,
  fvissNotes: "",
  confidentialNotes: "",
};

// ── Behaviour Tab ──────────────────────────────────────────────────────────────

const DEFAULT_SUPPORT = `\u2022 Reinforcing appropriate behaviour expectations at home\n\u2022 Discussing respectful and safe choices with your child\n\u2022 Supporting strategies such as [insert relevant strategies if needed]`;

type GuardianOption = { name: string; email: string };

function BehaviourTab({ childId, guardians }: { childId: number; guardians: GuardianOption[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canDelete } = usePermissions();

  const { data: notifications = [], isLoading } = useListChildBehaviouralNotifications(childId);
  const sendMutation = useSendBehaviouralNotification();
  const deleteMutation = useDeleteBehaviouralNotification();

  const [composeOpen, setComposeOpen] = useState(false);
  const [behaviourDescription, setBehaviourDescription] = useState("");
  const [supportRequest, setSupportRequest] = useState(DEFAULT_SUPPORT);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  function openCompose() {
    setBehaviourDescription("");
    setSupportRequest(DEFAULT_SUPPORT);
    setSelectedEmails(guardians.map(g => g.email));
    setComposeOpen(true);
  }

  function toggleEmail(email: string) {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEmails.length === 0) {
      toast({ title: "Select at least one guardian to notify", variant: "destructive" });
      return;
    }
    sendMutation.mutate(
      { id: childId, data: { behaviourDescription, supportRequest, recipientEmails: selectedEmails } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChildBehaviouralNotificationsQueryKey(childId) });
          setComposeOpen(false);
          toast({ title: "Behavioural notification sent" });
        },
        onError: () => toast({ title: "Failed to send notification", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Behavioural Email Log</h3>
          <p className="text-sm text-muted-foreground">Emails sent to guardians about this child's behaviour.</p>
        </div>
        <Button onClick={openCompose}>
          <Plus className="h-4 w-4 mr-1.5" />Send Email
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
            <MessageSquareWarning className="h-8 w-8 mb-2 opacity-25" />
            <p className="font-medium">No behavioural emails sent yet</p>
            <p className="text-sm mt-1">Use "Send Email" to notify guardians about a behaviour incident.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <Card key={n.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <CardTitle className="text-sm">{n.sentAt ? format(new Date(n.sentAt), "dd/MM/yyyy 'at' h:mm a") : "—"}</CardTitle>
                  <div className="flex items-center flex-wrap gap-1">
                    {n.recipientEmails?.map(e => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this notification record?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the behavioural notification sent on{" "}
                              {n.sentAt ? format(new Date(n.sentAt), "dd/MM/yyyy") : "this date"}.
                              The email already delivered to guardians will not be recalled.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() =>
                                deleteMutation.mutate(
                                  { id: childId, notifId: n.id },
                                  {
                                    onSuccess: () => {
                                      queryClient.invalidateQueries({ queryKey: getListChildBehaviouralNotificationsQueryKey(childId) });
                                      toast({ title: "Notification record deleted" });
                                    },
                                    onError: () => toast({ title: "Failed to delete record", variant: "destructive" }),
                                  }
                                )
                              }
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                {n.sentByStaffName && <p className="text-xs text-muted-foreground">Sent by {n.sentByStaffName}</p>}
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Behaviour Description</p>
                  <p className="text-sm whitespace-pre-wrap">{n.behaviourDescription}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Support Requested</p>
                  <p className="text-sm whitespace-pre-wrap">{n.supportRequest}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-amber-500" />
              Send Behavioural Notification
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSend} className="space-y-4 pt-1">
            {guardians.length > 0 && (
              <div className="space-y-2">
                <Label>Send to</Label>
                <div className="flex flex-col gap-2">
                  {guardians.map(g => (
                    <label key={g.email} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={selectedEmails.includes(g.email)}
                        onCheckedChange={() => toggleEmail(g.email)}
                        id={`guardian-${g.email}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none">{g.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{g.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedEmails.length === 0 && (
                  <p className="text-xs text-destructive">At least one guardian must be selected.</p>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground space-y-1">
              <p>Dear Parent/Guardian,</p>
              <p>We are writing to inform you that today your child displayed the following behaviour(s):</p>
            </div>

            <div className="space-y-1">
              <Label>Behaviour Description <span className="text-destructive">*</span></Label>
              <Textarea
                value={behaviourDescription}
                onChange={(e) => setBehaviourDescription(e.target.value)}
                rows={4}
                placeholder="Describe the behaviour(s) observed today…"
                required
                autoFocus
              />
            </div>

            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <p>At Elysium OSHC, we work closely with families to support positive behaviour and wellbeing for all students. We are hoping you can assist us with:</p>
            </div>

            <div className="space-y-1">
              <Label>Support Request <span className="text-destructive">*</span></Label>
              <Textarea
                value={supportRequest}
                onChange={(e) => setSupportRequest(e.target.value)}
                rows={5}
                required
              />
            </div>

            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground space-y-1">
              <p>We appreciate your partnership and support in helping your child make positive choices. If you would like to discuss this matter further, please feel free to contact us.</p>
              <p className="pt-1">Regards,</p>
              <p className="font-medium">Admin Team<br />ELYSIUM OSHC</p>
              <p>(03) 8595 3022 | 0466 047 908 | admin@elysiumoshc.com.au</p>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t">
              <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={sendMutation.isPending}>
                {sendMutation.isPending ? "Sending…" : "Send Email to Guardian(s)"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Medications Tab ────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "As needed (PRN)",
  "Weekly",
  "With food",
  "Before food",
  "After food",
];

const EMPTY_SLOT_FORM = { name: "", lastAdministered: "", toBeAdministeredBy: "", frequency: "", administrationTime: "", dosage: "", methodOfAdministration: "" };
const EMPTY_LOG_FORM = { administeredAt: "", dosageAdministered: "", methodOfAdministration: "", administeredById: 0, witnessId: null as number | null };

type StaffList = Staff[];

function MedicationsTab({ childId, staffList, currentUserId }: { childId: number; staffList: StaffList; currentUserId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: medications = [] } = useListChildMedications(childId);

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM);
  const [logForm, setLogForm] = useState({ ...EMPTY_LOG_FORM, administeredById: currentUserId });
  const [addingLog, setAddingLog] = useState(false);

  const selectedMed = medications.find(m => m.slot === selectedSlot) ?? null;

  const { data: logs = [], isLoading: logsLoading } = useListMedicationLogs(
    childId,
    selectedMed?.id ?? 0,
    { query: { queryKey: getListMedicationLogsQueryKey(childId, selectedMed?.id ?? 0), enabled: !!selectedMed?.id } }
  );

  useEffect(() => {
    if (selectedMed) {
      setLogForm({
        administeredAt: melbourneDateTimeStr(),
        dosageAdministered: selectedMed.dosage ?? "",
        methodOfAdministration: selectedMed.methodOfAdministration ?? "",
        administeredById: currentUserId,
        witnessId: null,
      });
      setAddingLog(false);
    }
  }, [selectedSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  const upsertMedMutation = useUpsertChildMedication();
  const createLogMutation = useCreateMedicationLog();
  const deleteLogMutation = useDeleteMedicationLog();

  function startEdit(slot: number) {
    const med = medications.find(m => m.slot === slot);
    setSlotForm({ name: med?.name ?? "", lastAdministered: med?.lastAdministered ?? "", toBeAdministeredBy: med?.toBeAdministeredBy ?? "", frequency: med?.frequency ?? "", administrationTime: med?.administrationTime ?? "", dosage: med?.dosage ?? "", methodOfAdministration: med?.methodOfAdministration ?? "" });
    setEditingSlot(slot);
  }

  function saveSlot(e: React.FormEvent, slot: number) {
    e.preventDefault();
    upsertMedMutation.mutate(
      { id: childId, slot, data: slotForm },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChildMedicationsQueryKey(childId) }); setEditingSlot(null); toast({ title: "Medication saved" }); },
        onError: () => toast({ title: "Failed to save medication", variant: "destructive" }),
      }
    );
  }

  function submitLog(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMed?.id) return;
    createLogMutation.mutate(
      { id: childId, medicationId: selectedMed.id, data: { ...logForm, administeredAt: melbourneLocalToUTCISO(logForm.administeredAt) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMedicationLogsQueryKey(childId, selectedMed.id) });
          queryClient.invalidateQueries({ queryKey: getListChildMedicationsQueryKey(childId) });
          setAddingLog(false);
          toast({ title: "Log entry added" });
        },
        onError: () => toast({ title: "Failed to add log", variant: "destructive" }),
      }
    );
  }

  function handleDeleteLog(logId: number) {
    if (!confirm("Delete this log entry?")) return;
    deleteLogMutation.mutate(
      { id: childId, medicationId: selectedMed!.id, logId },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMedicationLogsQueryKey(childId, selectedMed!.id) }); toast({ title: "Deleted" }); } }
    );
  }

  function addNewMedication() {
    const usedSlots = medications.map(m => m.slot);
    const nextSlot = [1, 2, 3, 4].find(s => !usedSlots.includes(s));
    if (nextSlot) startEdit(nextSlot);
  }

  const editForm = (slot: number) => (
    <Card key={slot} className="border-primary/30 col-span-1 sm:col-span-2 lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary" />
          {medications.find(m => m.slot === slot) ? "Edit Medication" : "New Medication"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => saveSlot(e, slot)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Medication Name *</Label><Input value={slotForm.name} onChange={(e) => setSlotForm(p => ({ ...p, name: e.target.value }))} required autoFocus /></div>
          <div className="space-y-1"><Label className="text-xs">Dosage</Label><Input value={slotForm.dosage} onChange={(e) => setSlotForm(p => ({ ...p, dosage: e.target.value }))} placeholder="e.g. 5ml" /></div>
          <div className="space-y-1"><Label className="text-xs">Method of Administration</Label><Input value={slotForm.methodOfAdministration} onChange={(e) => setSlotForm(p => ({ ...p, methodOfAdministration: e.target.value }))} placeholder="e.g. Oral" /></div>
          <div className="space-y-1">
            <Label className="text-xs">Frequency</Label>
            <Select value={slotForm.frequency || "_none"} onValueChange={(v) => setSlotForm(p => ({ ...p, frequency: v === "_none" ? "" : v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select frequency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none"><span className="text-muted-foreground">— not set —</span></SelectItem>
                {FREQUENCY_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Administration Time</Label>
            <Input type="time" value={slotForm.administrationTime} onChange={(e) => setSlotForm(p => ({ ...p, administrationTime: e.target.value }))} className="h-9" />
          </div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Last Administered</Label><Input value={slotForm.lastAdministered} onChange={(e) => setSlotForm(p => ({ ...p, lastAdministered: e.target.value }))} placeholder="e.g. 25/05/2026" /></div>
          <div className="flex gap-2 pt-1 sm:col-span-2">
            <Button type="submit" size="sm" disabled={upsertMedMutation.isPending}>Save</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingSlot(null)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Medications</h3>
          <p className="text-sm text-muted-foreground">Up to 4 medications can be tracked for this child.</p>
        </div>
        {medications.length < 4 && editingSlot === null && (
          <Button size="sm" onClick={addNewMedication}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add Medication
          </Button>
        )}
      </div>

      {/* Cards grid — only filled slots + inline edit form */}
      {(medications.length > 0 || editingSlot !== null) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((slot) => {
            const med = medications.find(m => m.slot === slot);
            const isSelected = selectedSlot === slot;

            if (editingSlot === slot) return editForm(slot);
            if (!med) return null;

            return (
              <Card key={slot} className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`} onClick={() => setSelectedSlot(isSelected ? null : slot)}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2 min-w-0">
                      <Pill className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{med.name}</span>
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); startEdit(slot); }}><Pencil className="h-3 w-3" /></Button>
                      {isSelected ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1 text-xs text-muted-foreground">
                  {med.dosage && <p><span className="font-medium text-foreground">Dosage:</span> {med.dosage}</p>}
                  {med.methodOfAdministration && <p><span className="font-medium text-foreground">Method:</span> {med.methodOfAdministration}</p>}
                  {med.frequency && <p><span className="font-medium text-foreground">Frequency:</span> {med.frequency}</p>}
                  {med.administrationTime && <p><span className="font-medium text-foreground">Time:</span> {med.administrationTime}</p>}
                  {med.lastAdministered && <p><span className="font-medium text-foreground">Last admin:</span> {med.lastAdministered}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
            <Pill className="h-8 w-8 mb-2 opacity-25" />
            <p className="font-medium">No medications added yet</p>
            <p className="text-sm mt-1">Use "Add Medication" to track a medication for this child.</p>
          </CardContent>
        </Card>
      )}


      {selectedSlot !== null && selectedMed && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" />Administration Log — {selectedMed.name}</CardTitle>
              <Button size="sm" onClick={() => setAddingLog(!addingLog)}><Plus className="h-3.5 w-3.5 mr-1" />Add Entry</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {addingLog && (
              <form onSubmit={submitLog} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">New Log Entry</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1"><Label className="text-xs">Date &amp; Time *</Label><Input type="datetime-local" value={logForm.administeredAt} onChange={(e) => setLogForm(p => ({ ...p, administeredAt: e.target.value }))} required /></div>
                  <div className="space-y-1"><Label className="text-xs">Dosage Administered *</Label><Input value={logForm.dosageAdministered} onChange={(e) => setLogForm(p => ({ ...p, dosageAdministered: e.target.value }))} required placeholder={selectedMed.dosage ?? ""} /></div>
                  <div className="space-y-1"><Label className="text-xs">Method *</Label><Input value={logForm.methodOfAdministration} onChange={(e) => setLogForm(p => ({ ...p, methodOfAdministration: e.target.value }))} required placeholder={selectedMed.methodOfAdministration ?? ""} /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Administered By *</Label>
                    <Select value={String(logForm.administeredById || "")} onValueChange={(v) => setLogForm(p => ({ ...p, administeredById: Number(v) }))}>
                      <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                      <SelectContent>{staffList.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Witness</Label>
                    <Select value={logForm.witnessId ? String(logForm.witnessId) : "none"} onValueChange={(v) => setLogForm(p => ({ ...p, witnessId: v === "none" ? null : Number(v) }))}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {staffList.filter(s => s.id !== logForm.administeredById).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={createLogMutation.isPending}>{createLogMutation.isPending ? "Saving…" : "Save Entry"}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAddingLog(false)}>Cancel</Button>
                </div>
              </form>
            )}
            {logsLoading ? (
              <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No administration records yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-3 py-2 font-medium">Date &amp; Time</th>
                      <th className="text-left px-3 py-2 font-medium">Dosage</th>
                      <th className="text-left px-3 py-2 font-medium">Method</th>
                      <th className="text-left px-3 py-2 font-medium">Administered By</th>
                      <th className="text-left px-3 py-2 font-medium">Witness</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map(log => {
                      const byStaff = staffList.find(s => s.id === log.administeredById);
                      const wStaff = log.witnessId ? staffList.find(s => s.id === log.witnessId) : null;
                      return (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{format(toMelbourneDate(log.administeredAt), "dd/MM/yy h:mm a")}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{log.dosageAdministered}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{log.methodOfAdministration}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{byStaff ? `${byStaff.firstName} ${byStaff.lastName}` : "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{wStaff ? `${wStaff.firstName} ${wStaff.lastName}` : "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => handleDeleteLog(log.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ChildProfile() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isEducatorRole, canDelete } = usePermissions();
  const { user } = useAuth();

  const [, navigate] = useLocation();

  const { data: child, isLoading } = useGetChild(id, { query: { queryKey: getGetChildQueryKey(id), enabled: !!id } });
  const { data: observations, isLoading: obsLoading } = useGetChildObservations(id, { query: { queryKey: getGetChildObservationsQueryKey(id), enabled: !!id } });
  const { data: sites } = useListSites();
  const { data: staff } = useListStaff();
  const { data: welfareNotes, isLoading: welfareLoading } = useGetChildWelfareNotes(id, { query: { queryKey: getGetChildWelfareNotesQueryKey(id), enabled: !!id } });
  const { data: confidentialNotes, isLoading: confidentialLoading } = useGetChildConfidentialNotes(id, { query: { queryKey: getGetChildConfidentialNotesQueryKey(id), enabled: !!id } });
  const { data: allJottings } = useListJottings({ includeArchived: true });
  const { data: allPlanningExperiences } = useListPlanningExperiences();
  const { data: allPosts } = useListPosts();
  const updateMutation = useUpdateChild();
  const deleteMutation = useDeleteChild();
  const createWelfareMutation = useCreateWelfareNote();
  const updateWelfareMutation = useUpdateWelfareNote();
  const deleteWelfareMutation = useDeleteWelfareNote();
  const createConfidentialMutation = useCreateConfidentialNote();
  const updateConfidentialMutation = useUpdateConfidentialNote();
  const deleteConfidentialMutation = useDeleteConfidentialNote();

  const [editOpen, setEditOpen] = useState(false);
  const [guardianView, setGuardianView] = useState<1 | 2>(1);
  const [welfareOpen, setWelfareOpen] = useState(false);
  const [welfareForm, setWelfareForm] = useState(EMPTY_WELFARE_FORM);
  const [editingWelfareNoteId, setEditingWelfareNoteId] = useState<number | null>(null);

  const [confNoteText, setConfNoteText] = useState("");
  const [confNoteStaffId, setConfNoteStaffId] = useState("");
  const [confAddOpen, setConfAddOpen] = useState(false);
  const [editingConfNote, setEditingConfNote] = useState<{ id: number; content: string } | null>(null);
  const [evidenceObjectPath, setEvidenceObjectPath] = useState<string | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState<string | null>(null);

  const { data: childSettings } = useGetChildSettings({ query: { queryKey: getGetChildSettingsQueryKey() } });
  const showPhoto = childSettings?.childDisplayMode === "profile_picture";

  const { uploadFile, isUploading: isUploadingEvidence } = useUpload({
    onError: () => toast({ title: "File upload failed", variant: "destructive" }),
  });

  const { uploadFile: uploadProfilePic, isUploading: isUploadingPic } = useUpload({
    onError: () => toast({ title: "Photo upload failed", variant: "destructive" }),
  });

  async function handleProfilePicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const response = await uploadProfilePic(file);
    if (!response) return;
    await updateMutation.mutateAsync({ id, data: { profilePicturePath: response.objectPath } as any });
    queryClient.invalidateQueries({ queryKey: [`/api/children/${id}`] });
    toast({ title: "Profile photo updated" });
    e.target.value = "";
  }

  const { data: childDocuments, isLoading: docsLoading } = useListChildDocuments(id, { query: { queryKey: getListChildDocumentsQueryKey(id), enabled: !!id } });
  const createDocMutation = useCreateChildDocument();
  const deleteDocMutation = useDeleteChildDocument();
  const { uploadFile: uploadDoc, isUploading: isUploadingDoc } = useUpload({
    onError: () => toast({ title: "Document upload failed", variant: "destructive" }),
  });

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadDoc(file);
    if (!result) return;
    createDocMutation.mutate(
      { id, data: { documentPath: result.objectPath, documentName: file.name } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/documents`] });
          toast({ title: "Document uploaded" });
        },
        onError: () => toast({ title: "Failed to save document", variant: "destructive" }),
      }
    );
    e.target.value = "";
  }

  function handleDocDelete(docId: number, docName: string | null) {
    if (!confirm(`Delete "${docName ?? "this document"}"?`)) return;
    deleteDocMutation.mutate(
      { id, docId },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/documents`] }),
        onError: () => toast({ title: "Failed to delete document", variant: "destructive" }),
      }
    );
  }

  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", enrollmentDate: "",
    status: "", guardianName: "", guardianEmail: "", guardianPhone: "",
    guardian2Name: "", guardian2Email: "", guardian2Phone: "",
    medicalNotes: "", likes: "", dislikes: "", temperament: "", background: "",
    siteId: "" as string,
  });

  function openEdit() {
    if (!child) return;
    setForm({
      firstName: child.firstName,
      lastName: child.lastName,
      dateOfBirth: format(new Date(child.dateOfBirth as unknown as string), "yyyy-MM-dd"),
      enrollmentDate: format(new Date(child.enrollmentDate as unknown as string), "yyyy-MM-dd"),
      status: child.status,
      guardianName: child.guardianName,
      guardianEmail: child.guardianEmail,
      guardianPhone: child.guardianPhone,
      guardian2Name: child.guardian2Name ?? "",
      guardian2Email: child.guardian2Email ?? "",
      guardian2Phone: child.guardian2Phone ?? "",
      medicalNotes: child.medicalNotes ?? "",
      likes: child.likes ?? "",
      dislikes: child.dislikes ?? "",
      temperament: child.temperament ?? "",
      background: child.background ?? "",
      siteId: child.siteId != null ? String(child.siteId) : "",
    });
    setEditOpen(true);
  }

  function handleDelete() {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/children"] });
        toast({ title: "Profile deleted" });
        navigate("/children");
      },
      onError: () => toast({ title: "Failed to delete profile", variant: "destructive" }),
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { ...form };
    if (!data.medicalNotes) delete data.medicalNotes;
    if (!data.likes) delete data.likes;
    if (!data.dislikes) delete data.dislikes;
    if (!data.temperament) delete data.temperament;
    if (!data.background) delete data.background;
    if (!data.guardian2Name) data.guardian2Name = null;
    if (!data.guardian2Email) data.guardian2Email = null;
    if (!data.guardian2Phone) data.guardian2Phone = null;
    data.siteId = form.siteId ? parseInt(form.siteId) : null;
    updateMutation.mutate({ id, data: data as any }, {
      onSuccess: () => {
        setEditOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}`] });
        toast({ title: "Profile updated" });
      },
      onError: () => toast({ title: "Failed to save changes", variant: "destructive" }),
    });
  }

  function buildWelfareBody() {
    const body: Record<string, unknown> = {
      childId: id,
      occurredAt: new Date(welfareForm.occurredAt).toISOString(),
      concerns: welfareForm.concerns,
      riskFactors: welfareForm.riskFactors,
      mandatoryReportRequired: welfareForm.mandatoryReportRequired,
      cissThresholdMet: welfareForm.cissThresholdMet,
      fvissThresholdMet: welfareForm.fvissThresholdMet,
    };
    if (welfareForm.staffId) body.staffId = parseInt(welfareForm.staffId);
    if (evidenceObjectPath) body.evidence = evidenceObjectPath;
    if (welfareForm.mandatoryReportNotes) body.mandatoryReportNotes = welfareForm.mandatoryReportNotes;
    if (welfareForm.cissNotes) body.cissNotes = welfareForm.cissNotes;
    if (welfareForm.fvissNotes) body.fvissNotes = welfareForm.fvissNotes;
    if (welfareForm.confidentialNotes) body.confidentialNotes = welfareForm.confidentialNotes;
    return body;
  }

  function closeWelfareDialog() {
    setWelfareOpen(false);
    setWelfareForm(EMPTY_WELFARE_FORM);
    setEvidenceObjectPath(null);
    setEvidenceFileName(null);
    setEditingWelfareNoteId(null);
  }

  function handleWelfareNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = buildWelfareBody();

    if (editingWelfareNoteId !== null) {
      updateWelfareMutation.mutate({ id: editingWelfareNoteId, data: body as any }, {
        onSuccess: () => {
          closeWelfareDialog();
          queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/welfare-notes`] });
          toast({ title: "Welfare note updated" });
        },
        onError: () => toast({ title: "Failed to update welfare note", variant: "destructive" }),
      });
    } else {
      createWelfareMutation.mutate({ data: body as any }, {
        onSuccess: () => {
          closeWelfareDialog();
          queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/welfare-notes`] });
          toast({ title: "Welfare note recorded" });
        },
        onError: () => toast({ title: "Failed to save welfare note", variant: "destructive" }),
      });
    }
  }

  function openEditWelfareNote(note: NonNullable<typeof welfareNotes>[number]) {
    setWelfareForm({
      occurredAt: note.occurredAt.slice(0, 16),
      staffId: note.staffId != null ? String(note.staffId) : "",
      concerns: note.concerns,
      riskFactors: note.riskFactors,
      mandatoryReportRequired: note.mandatoryReportRequired,
      mandatoryReportNotes: note.mandatoryReportNotes ?? "",
      cissThresholdMet: note.cissThresholdMet,
      cissNotes: note.cissNotes ?? "",
      fvissThresholdMet: note.fvissThresholdMet,
      fvissNotes: note.fvissNotes ?? "",
      confidentialNotes: note.confidentialNotes ?? "",
    });
    setEvidenceObjectPath(note.evidence ?? null);
    setEvidenceFileName(note.evidence ? note.evidence.split("/").pop() ?? null : null);
    setEditingWelfareNoteId(note.id);
    setWelfareOpen(true);
  }

  function handleDeleteWelfareNote(noteId: number) {
    deleteWelfareMutation.mutate({ id: noteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/welfare-notes`] });
        toast({ title: "Welfare note deleted" });
      },
      onError: () => toast({ title: "Failed to delete welfare note", variant: "destructive" }),
    });
  }

  function handleCreateConfidentialNote(e: React.FormEvent) {
    e.preventDefault();
    if (!confNoteText.trim()) return;
    const body: Record<string, unknown> = { childId: id, content: confNoteText.trim() };
    if (confNoteStaffId) body.staffId = parseInt(confNoteStaffId);
    createConfidentialMutation.mutate({ data: body as any }, {
      onSuccess: () => {
        setConfAddOpen(false);
        setConfNoteText("");
        setConfNoteStaffId("");
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/confidential-notes`] });
        toast({ title: "Confidential note added" });
      },
      onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
    });
  }

  function handleUpdateConfidentialNote(e: React.FormEvent) {
    e.preventDefault();
    if (!editingConfNote || !editingConfNote.content.trim()) return;
    updateConfidentialMutation.mutate({ id: editingConfNote.id, data: { childId: id, content: editingConfNote.content.trim() } as any }, {
      onSuccess: () => {
        setEditingConfNote(null);
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/confidential-notes`] });
        toast({ title: "Note updated" });
      },
      onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
    });
  }

  function handleDeleteConfidentialNote(noteId: number) {
    deleteConfidentialMutation.mutate({ id: noteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/confidential-notes`] });
        toast({ title: "Note deleted" });
      },
      onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
    });
  }

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!child) {
    return <div>Child not found</div>;
  }

  const hasProfileInfo = child.likes || child.dislikes || child.temperament || child.background;
  const assignedSite = sites?.find((s) => s.id === child.siteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/children">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative group">
              {showPhoto && child.profilePicturePath ? (
                <img
                  src={storageUrl(child.profilePicturePath)}
                  alt={`${child.firstName} ${child.lastName}`}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold select-none">
                  {child.firstName[0]}{child.lastName[0]}
                </div>
              )}
              {showPhoto && (
                <label
                  className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                  title="Upload photo"
                >
                  <Upload className="h-4 w-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleProfilePicUpload}
                    disabled={isUploadingPic}
                  />
                </label>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-none">{child.firstName} {child.lastName}</h1>
              <div className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                <Badge variant={child.status === "active" ? "default" : "secondary"} className="capitalize">{child.status}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openEdit}>
              <Edit className="h-4 w-4 mr-2" />Edit Profile
            </Button>
            {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/30">
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {child.firstName} {child.lastName}'s profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the child's profile and all associated data including observations. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete Profile"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") ?? "overview"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="childdata">Child's Data</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="medications" className="flex items-center gap-1.5"><Pill className="h-3.5 w-3.5" />Medications</TabsTrigger>
          <TabsTrigger value="behaviour" className="flex items-center gap-1.5"><MessageSquareWarning className="h-3.5 w-3.5" />Behaviour</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {assignedSite && (
                <>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />Site</div>
                    <p className="font-medium">{assignedSite.name}</p>
                  </div>
                  <Separator />
                </>
              )}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Age</div>
                <p className="font-medium">{(() => {
                  const dob = child.dateOfBirth;
                  const birth = new Date(String(dob).length === 10 ? dob + "T00:00:00" : dob);
                  const now = new Date();
                  const years = differenceInYears(now, birth);
                  if (years < 1) {
                    const months = differenceInMonths(now, birth);
                    return `${months} month${months !== 1 ? "s" : ""}`;
                  }
                  return `${years} year${years !== 1 ? "s" : ""}`;
                })()}</p>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Date of Birth</div>
                <p className="font-medium">{safeDate(child.dateOfBirth, "dd/MM/yyyy")}</p>
              </div>
              <Separator />
              {/* Guardian toggle */}
              <div className="flex items-center gap-1 p-0.5 bg-muted rounded-md w-fit">
                <button
                  type="button"
                  onClick={() => setGuardianView(1)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${guardianView === 1 ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Guardian 1
                </button>
                <button
                  type="button"
                  onClick={() => setGuardianView(2)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${guardianView === 2 ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Guardian 2
                </button>
              </div>
              {guardianView === 1 ? (
                <>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" />Name</div>
                    <p className="font-medium">{child.guardianName}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" />Phone</div>
                    <p className="font-medium">{child.guardianPhone}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Email</div>
                    <p className="font-medium">{child.guardianEmail}</p>
                  </div>
                </>
              ) : (
                <>
                  {child.guardian2Name ? (
                    <>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" />Name</div>
                        <p className="font-medium">{child.guardian2Name}</p>
                      </div>
                      {child.guardian2Phone && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" />Phone</div>
                          <p className="font-medium">{child.guardian2Phone}</p>
                        </div>
                      )}
                      {child.guardian2Email && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Email</div>
                          <p className="font-medium">{child.guardian2Email}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No second guardian recorded. Edit the profile to add one.</p>
                  )}
                </>
              )}
              {child.medicalNotes && (
                <>
                  <Separator />
                  <div className="space-y-1 bg-destructive/10 p-3 rounded-md border border-destructive/20 text-destructive">
                    <div className="text-sm font-semibold">Medical Notes</div>
                    <p className="text-sm">{child.medicalNotes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {hasProfileInfo ? (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Child Profile</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-5">
              {child.likes && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" />Likes</div>
                  <p className="text-sm leading-relaxed">{child.likes}</p>
                </div>
              )}
              {child.dislikes && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-slate-400" />Dislikes</div>
                  <p className="text-sm leading-relaxed">{child.dislikes}</p>
                </div>
              )}
              {child.temperament && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><Smile className="h-4 w-4" />Temperament</div>
                  <p className="text-sm leading-relaxed">{child.temperament}</p>
                </div>
              )}
              {child.background && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><BookOpen className="h-4 w-4" />Background</div>
                  <p className="text-sm leading-relaxed">{child.background}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="md:col-span-2 border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              <Smile className="h-6 w-6 mx-auto mb-2 opacity-40" />
              <p>No profile info added yet.</p>
              <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={openEdit}>Add likes, dislikes & more</Button>
            </CardContent>
          </Card>
        )}
      </div>
      {/* Welfare Notification Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Welfare Notification Log
          </CardTitle>
          <Button size="sm" onClick={() => { setWelfareForm(EMPTY_WELFARE_FORM); setEvidenceObjectPath(null); setEvidenceFileName(null); setEditingWelfareNoteId(null); setWelfareOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />New Welfare Note
          </Button>
        </CardHeader>
        <CardContent>
          {welfareLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !welfareNotes || welfareNotes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No welfare notifications recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...welfareNotes].reverse().map((note) => (
                <div key={note.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium">
                          {safeDate(note.occurredAt, "dd/MM/yyyy, h:mm a")}
                        </span>
                        {note.staffName && (
                          <span className="text-xs text-muted-foreground">Recorded by {note.staffName}</span>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {note.mandatoryReportRequired && (
                          <Badge variant="destructive" className="text-xs">Mandatory Report</Badge>
                        )}
                        {note.cissThresholdMet && (
                          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">CISS Threshold</Badge>
                        )}
                        {note.fvissThresholdMet && (
                          <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">FVISS Threshold</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditWelfareNote(note)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete welfare note?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this welfare notification record. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteWelfareNote(note.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Concerns</p>
                      <p className="leading-relaxed">{note.concerns}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Factors</p>
                      <p className="leading-relaxed">{note.riskFactors}</p>
                    </div>
                    {note.evidence && (
                      <div className="space-y-1 md:col-span-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evidence / Observations</p>
                        <p className="leading-relaxed">{note.evidence}</p>
                      </div>
                    )}
                    {note.mandatoryReportRequired && note.mandatoryReportNotes && (
                      <div className="space-y-1 md:col-span-2 bg-destructive/5 border border-destructive/20 rounded p-2">
                        <p className="text-xs font-medium text-destructive uppercase tracking-wide">Mandatory Report Notes</p>
                        <p className="leading-relaxed">{note.mandatoryReportNotes}</p>
                      </div>
                    )}
                    {note.cissThresholdMet && note.cissNotes && (
                      <div className="space-y-1 bg-amber-50 border border-amber-200 rounded p-2">
                        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">CISS Notes</p>
                        <p className="leading-relaxed">{note.cissNotes}</p>
                      </div>
                    )}
                    {note.fvissThresholdMet && note.fvissNotes && (
                      <div className="space-y-1 bg-orange-50 border border-orange-200 rounded p-2">
                        <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">FVISS Notes</p>
                        <p className="leading-relaxed">{note.fvissNotes}</p>
                      </div>
                    )}
                    {note.confidentialNotes && (
                      <div className="space-y-1 md:col-span-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded p-2">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <Lock className="h-3 w-3" />Confidential Notes
                        </p>
                        <p className="leading-relaxed">{note.confidentialNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidential Notes — Admin & Educational Leader only */}
      {!isEducatorRole && <Card className="border-slate-300 dark:border-slate-600">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-600" />
              Confidential Notes
            </CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-700 dark:text-slate-300 font-medium">
                Admin &amp; Educational Leader only
              </span>
            </p>
          </div>
          <Button size="sm" onClick={() => { setConfNoteText(""); setConfNoteStaffId(""); setConfAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Add Note
          </Button>
        </CardHeader>
        <CardContent>
          {confidentialLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !confidentialNotes || confidentialNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Lock className="h-7 w-7 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No confidential notes recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...confidentialNotes].reverse().map((note) => (
                <div key={note.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                  {editingConfNote?.id === note.id ? (
                    <form onSubmit={handleUpdateConfidentialNote} className="space-y-3">
                      <Textarea
                        value={editingConfNote.content}
                        onChange={(e) => setEditingConfNote({ ...editingConfNote, content: e.target.value })}
                        rows={3}
                        autoFocus
                        required
                      />
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingConfNote(null)}>Cancel</Button>
                        <Button type="submit" size="sm" disabled={updateConfidentialMutation.isPending}>Save</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-1">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          <span>{safeDate(note.createdAt, "dd/MM/yyyy, h:mm a")}</span>
                          {note.staffName && <><span>·</span><span>{note.staffName}</span></>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingConfNote({ id: note.id, content: note.content })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete confidential note?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove this note. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteConfidentialNote(note.id)}
                              >Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>}
        </TabsContent>

        {/* ── Child's Data ── */}
        <TabsContent value="childdata" className="space-y-6">
          {(() => {
            const childJottings = (allJottings ?? []).filter((j) => j.childId === child.id);
            const childPlanningExps = (allPlanningExperiences ?? []).filter((p) => (p.childIds ?? []).includes(child.id));
            const childPosts = (allPosts ?? []).filter((p) => (p.childIds ?? []).includes(child.id));

            return (
              <>
                {/* Jottings */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <StickyNote className="h-5 w-5" />Jottings
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {childJottings.filter((j) => !j.archivedAt).length} unactioned · {childJottings.filter((j) => j.archivedAt).length} actioned
                    </span>
                  </CardHeader>
                  <CardContent>
                    {childJottings.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">No jottings recorded for this child</div>
                    ) : (
                      <div className="space-y-2">
                        {[...childJottings].reverse().map((j) => (
                          <div key={j.id} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${j.archivedAt ? "bg-muted/40 opacity-70" : "bg-green-50"}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="leading-relaxed line-clamp-2 flex-1">{j.content}</p>
                                {j.archivedAt && <Badge variant="secondary" className="text-xs shrink-0">Actioned</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{safeDate(j.createdAt, "dd/MM/yyyy")}{j.staffName ? ` · ${j.staffName}` : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Observations */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-5 w-5" />Observations
                    </CardTitle>
                    <Link href={`/observations/new?childId=${child.id}`}>
                      <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />New</Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {obsLoading ? (
                      <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
                    ) : !observations || observations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">No observations recorded yet</div>
                    ) : (
                      <div className="flex flex-col divide-y">
                        {observations.map((obs) => (
                          <Link key={obs.id} href={`/observations/${obs.id}`}>
                            <div className="py-2.5 px-2 grid grid-cols-[1fr_auto_auto] gap-x-4 items-center bg-green-50 hover:bg-green-100 rounded transition-colors cursor-pointer">
                              <p className="text-sm line-clamp-1 leading-relaxed">{obs.description}</p>
                              <p className="text-xs text-muted-foreground whitespace-nowrap">{obs.staffName ?? "—"}</p>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground whitespace-nowrap">{safeDate(obs.observationDate, "dd/MM/yyyy")}</p>
                                <p className="text-xs text-muted-foreground whitespace-nowrap">Edited {safeDate(obs.updatedAt, "dd/MM/yyyy")}</p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Programmed Experiences */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />Programmed Experiences
                    </CardTitle>
                    <Link href="/planning"><Button size="sm" variant="outline">View all</Button></Link>
                  </CardHeader>
                  <CardContent>
                    {childPlanningExps.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                        No planning cycles linked to this child
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {childPlanningExps.map((p) => (
                          <Link key={p.id} href={`/planning/${p.id}`}>
                            <div className="px-3 py-2.5 rounded-lg border bg-green-50 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate flex-1">{p.title}</span>
                              <Badge variant="outline" className="text-xs capitalize shrink-0">{p.stage}</Badge>
                              {p.startDate && <span className="text-xs text-muted-foreground shrink-0">{safeDate(p.startDate, "dd/MM/yyyy")}</span>}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Posts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Newspaper className="h-5 w-5" />Posts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {childPosts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">No posts for this child</div>
                    ) : (
                      <div className="space-y-0">
                        <div className="divide-y">
                          {[...childPosts].reverse().slice(0, 3).map((p) => (
                            <Link key={p.id} href={`/posts/${p.id}?back=/children/${child.id}%3Ftab%3Dchilddata`}>
                              <div className="py-3 flex items-center justify-between gap-4 bg-green-50 hover:bg-green-100 px-2 rounded cursor-pointer">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {p.date ? safeDate(p.date.slice(0, 10) + "T00:00:00", "dd/MM/yyyy") : safeDate(p.createdAt, "dd/MM/yyyy")}
                                    {p.staffName ? ` · ${p.staffName}` : ""}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                        {childPosts.length > 3 && (
                          <div className="pt-3">
                            <Link href={`/posts?childId=${child.id}`}>
                              <Button variant="outline" size="sm" className="w-full">
                                Show more ({childPosts.length - 3} more)
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                Documents
              </CardTitle>
              <label className={`inline-flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground ${isUploadingDoc ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="h-3.5 w-3.5" />
                {isUploadingDoc ? "Uploading…" : "Upload Document"}
                <input
                  type="file"
                  className="hidden"
                  disabled={isUploadingDoc}
                  onChange={handleDocUpload}
                />
              </label>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !childDocuments || childDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                  <FolderOpen className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm font-medium">No documents uploaded yet</p>
                  <p className="text-xs mt-1">Use the Upload Document button to add files for this child.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {childDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 py-2.5 group">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a
                        href={`/api/storage/objects/${doc.documentPath.replace(/^\/?(objects\/)?/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-sm font-medium text-primary hover:underline underline-offset-4 truncate"
                      >
                        {doc.documentName ?? doc.documentPath.split("/").pop()}
                      </a>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                        {format(new Date(doc.uploadedAt), "dd/MM/yyyy")}
                      </span>
                      {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDocDelete(doc.id, doc.documentName ?? null)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Medications ── */}
        <TabsContent value="medications">
          <MedicationsTab childId={id} staffList={staff ?? []} currentUserId={user?.id ?? 0} />
        </TabsContent>

        {/* ── Behaviour ── */}
        <TabsContent value="behaviour">
          <BehaviourTab
            childId={id}
            guardians={[
              child?.guardianName && child?.guardianEmail
                ? { name: child.guardianName, email: child.guardianEmail }
                : null,
              child?.guardian2Name && child?.guardian2Email
                ? { name: child.guardian2Name, email: child.guardian2Email }
                : null,
            ].filter((g): g is GuardianOption => g !== null)}
          />
        </TabsContent>

      </Tabs>

      {/* Add Confidential Note Dialog — Admin & Educational Leader only */}
      {!isEducatorRole && <Dialog open={confAddOpen} onOpenChange={setConfAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-600" />
              Add Confidential Note
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateConfidentialNote} className="space-y-4">
            <div className="rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
              This note is marked confidential and will be restricted to Admin and Educational Leader roles once authentication is configured.
            </div>
            <div className="space-y-1">
              <Label>Staff Member <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={confNoteStaffId || "none"} onValueChange={(v) => setConfNoteStaffId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Note <span className="text-destructive">*</span></Label>
              <Textarea
                value={confNoteText}
                onChange={(e) => setConfNoteText(e.target.value)}
                rows={5}
                placeholder="Enter confidential note..."
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t">
              <Button type="button" variant="outline" onClick={() => setConfAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createConfidentialMutation.isPending}>
                {createConfidentialMutation.isPending ? "Saving…" : "Save Note"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>}

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Child Profile</DialogTitle></DialogHeader>
          <form onSubmit={handleSave}>
            <Tabs defaultValue="details">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="guardian">Guardian</TabsTrigger>
                <TabsTrigger value="profile">Profile Info</TabsTrigger>
                <TabsTrigger value="childdata">Child's Data</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
                  <div className="space-y-1"><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
                </div>
                <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="waitlist">Waitlist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Site</Label>
                  <Select value={form.siteId || "none"} onValueChange={(v) => setForm({ ...form, siteId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="No site assigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No site</SelectItem>
                      {sites?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Medical Notes</Label><Textarea value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} rows={3} placeholder="Allergies, conditions, medications..." /></div>
              </TabsContent>

              <TabsContent value="guardian" className="space-y-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Guardian 1</p>
                <div className="space-y-1"><Label>Name</Label><Input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Phone</Label><Input type="text" autoComplete="tel" placeholder="e.g. 0400 000 000" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} required /></div>
                <Separator />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Guardian 2 <span className="normal-case font-normal">(optional)</span></p>
                <div className="space-y-1"><Label>Name</Label><Input value={form.guardian2Name} onChange={(e) => setForm({ ...form, guardian2Name: e.target.value })} placeholder="Full name" /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.guardian2Email} onChange={(e) => setForm({ ...form, guardian2Email: e.target.value })} placeholder="email@example.com" /></div>
                <div className="space-y-1"><Label>Phone</Label><Input type="text" autoComplete="tel" value={form.guardian2Phone} onChange={(e) => setForm({ ...form, guardian2Phone: e.target.value })} placeholder="e.g. 0400 000 000" /></div>
              </TabsContent>

              <TabsContent value="profile" className="space-y-4">
                <p className="text-sm text-muted-foreground">This information helps educators understand and support the child's learning and wellbeing.</p>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Smile className="h-4 w-4" />Temperament</Label>
                  <Textarea value={form.temperament} onChange={(e) => setForm({ ...form, temperament: e.target.value })} rows={3} placeholder="e.g. Calm and observant, takes time to warm up, energetic and social..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><BookOpen className="h-4 w-4" />Background</Label>
                  <Textarea value={form.background} onChange={(e) => setForm({ ...form, background: e.target.value })} rows={3} placeholder="Cultural background, family structure, languages spoken at home, prior care experience..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" />Likes</Label>
                  <Textarea value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} rows={3} placeholder="e.g. Dinosaurs, painting, outdoor play, listening to stories..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-slate-400" />Dislikes</Label>
                  <Textarea value={form.dislikes} onChange={(e) => setForm({ ...form, dislikes: e.target.value })} rows={3} placeholder="e.g. Loud noises, sand textures, transitions between activities..." />
                </div>
              </TabsContent>

              <TabsContent value="childdata" className="space-y-4">
                <p className="text-sm text-muted-foreground">Enrollment and placement details for this child.</p>
                <div className="space-y-1">
                  <Label>Enrollment Date</Label>
                  <Input type="date" value={form.enrollmentDate} onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })} required />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Welfare Note Dialog */}
      <Dialog open={welfareOpen} onOpenChange={(open) => { if (!open) closeWelfareDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {editingWelfareNoteId !== null ? "Edit Welfare Note" : "Record Welfare Notification"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWelfareNoteSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date &amp; Time of Concern</Label>
                <Input
                  type="datetime-local"
                  value={welfareForm.occurredAt}
                  onChange={(e) => setWelfareForm({ ...welfareForm, occurredAt: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Recorded By (Staff)</Label>
                <Select value={welfareForm.staffId || "none"} onValueChange={(v) => setWelfareForm({ ...welfareForm, staffId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {staff?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Concerns <span className="text-destructive">*</span></Label>
              <Textarea
                value={welfareForm.concerns}
                onChange={(e) => setWelfareForm({ ...welfareForm, concerns: e.target.value })}
                rows={3}
                placeholder="Describe the specific welfare concerns observed..."
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Risk Factors <span className="text-destructive">*</span></Label>
              <Textarea
                value={welfareForm.riskFactors}
                onChange={(e) => setWelfareForm({ ...welfareForm, riskFactors: e.target.value })}
                rows={3}
                placeholder="List the risk factors identified..."
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Evidence File <span className="text-muted-foreground text-xs">(optional — photo, document, etc.)</span></Label>
              {evidenceFileName ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{evidenceFileName}</span>
                  <button
                    type="button"
                    onClick={() => { setEvidenceObjectPath(null); setEvidenceFileName(null); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary ${isUploadingEvidence ? "opacity-50 pointer-events-none" : ""}`}>
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span>{isUploadingEvidence ? "Uploading…" : "Click to attach a file"}</span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={isUploadingEvidence}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const result = await uploadFile(file);
                      if (result) {
                        setEvidenceObjectPath(result.objectPath);
                        setEvidenceFileName(file.name);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Threshold Assessments</p>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="mandatory-report"
                    checked={welfareForm.mandatoryReportRequired}
                    onCheckedChange={(v) => setWelfareForm({ ...welfareForm, mandatoryReportRequired: !!v })}
                  />
                  <Label htmlFor="mandatory-report" className="font-medium cursor-pointer">
                    Mandatory Report Required
                  </Label>
                </div>
                {welfareForm.mandatoryReportRequired && (
                  <div className="ml-7 space-y-1">
                    <Label className="text-xs text-muted-foreground">Mandatory Report Notes</Label>
                    <Textarea
                      value={welfareForm.mandatoryReportNotes}
                      onChange={(e) => setWelfareForm({ ...welfareForm, mandatoryReportNotes: e.target.value })}
                      rows={2}
                      placeholder="Details of mandatory reporting action taken..."
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="ciss"
                    checked={welfareForm.cissThresholdMet}
                    onCheckedChange={(v) => setWelfareForm({ ...welfareForm, cissThresholdMet: !!v })}
                  />
                  <Label htmlFor="ciss" className="font-medium cursor-pointer">
                    CISS Threshold Met
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(Child Information Sharing Scheme)</span>
                  </Label>
                </div>
                {welfareForm.cissThresholdMet && (
                  <div className="ml-7 space-y-1">
                    <Label className="text-xs text-muted-foreground">CISS Notes</Label>
                    <Textarea
                      value={welfareForm.cissNotes}
                      onChange={(e) => setWelfareForm({ ...welfareForm, cissNotes: e.target.value })}
                      rows={2}
                      placeholder="Information sharing actions and rationale..."
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="fviss"
                    checked={welfareForm.fvissThresholdMet}
                    onCheckedChange={(v) => setWelfareForm({ ...welfareForm, fvissThresholdMet: !!v })}
                  />
                  <Label htmlFor="fviss" className="font-medium cursor-pointer">
                    FVISS Threshold Met
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(Family Violence Information Sharing Scheme)</span>
                  </Label>
                </div>
                {welfareForm.fvissThresholdMet && (
                  <div className="ml-7 space-y-1">
                    <Label className="text-xs text-muted-foreground">FVISS Notes</Label>
                    <Textarea
                      value={welfareForm.fvissNotes}
                      onChange={(e) => setWelfareForm({ ...welfareForm, fvissNotes: e.target.value })}
                      rows={2}
                      placeholder="Family violence information sharing actions and rationale..."
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Confidential Notes</p>
                  <p className="text-xs text-muted-foreground">Admin &amp; Educational Leader only — restriction enforced when authentication is added</p>
                </div>
              </div>
              <Textarea
                value={welfareForm.confidentialNotes}
                onChange={(e) => setWelfareForm({ ...welfareForm, confidentialNotes: e.target.value })}
                rows={3}
                placeholder="Notes restricted to Admin and Educational Leader roles only..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeWelfareDialog}>Cancel</Button>
              <Button type="submit" disabled={createWelfareMutation.isPending || updateWelfareMutation.isPending}>
                {createWelfareMutation.isPending || updateWelfareMutation.isPending
                  ? "Saving…"
                  : editingWelfareNoteId !== null ? "Save Changes" : "Save Welfare Note"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
