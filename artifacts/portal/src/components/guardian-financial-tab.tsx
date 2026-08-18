import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  X,
  Save,
  Trash2,
  Plus,
  Phone,
  DollarSign,
} from "lucide-react";
import { fmtMelb } from "@/lib/timezone";

type FinancialStatus = "active" | "payment_plan" | "suspended";

type FinancialData = {
  status: FinancialStatus;
  communications: Array<{
    id: number;
    note: string;
    staffName: string | null;
    createdAt: string;
  }>;
  plans: Array<{
    id: number;
    type: string;
    amount: string;
    frequency: string | null;
    description: string | null;
    expectedDate: string | null;
    startDate: string | null;
    endDate: string | null;
    receivedAt: string | null;
    createdAt: string;
  }>;
};

const STATUS_CONFIG: Record<
  FinancialStatus,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  active: {
    label: "Active",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle2,
  },
  payment_plan: {
    label: "Payment Plan",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Clock,
  },
  suspended: {
    label: "Suspended",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    icon: AlertCircle,
  },
};

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

interface Props {
  encodedEmail: string;
  guardianName: string;
}

export function GuardianFinancialTab({ encodedEmail, guardianName }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const qKey = ["guardian-financial", encodedEmail];

  // ── Status editing ─────────────────────────────────────────────────────────
  const [editingStatus, setEditingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<FinancialStatus>("active");
  const [savingStatus, setSavingStatus] = useState(false);

  // ── Communication log form ─────────────────────────────────────────────────
  const [showCommForm, setShowCommForm] = useState(false);
  const [commNote, setCommNote] = useState("");
  const [savingComm, setSavingComm] = useState(false);

  // ── Payment plan form ──────────────────────────────────────────────────────
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planType, setPlanType] = useState<"one_off" | "recurring">("one_off");
  const [planAmount, setPlanAmount] = useState("");
  const [planFrequency, setPlanFrequency] = useState("weekly");
  const [planDesc, setPlanDesc] = useState("");
  const [planExpectedDate, setPlanExpectedDate] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [planEndDate, setPlanEndDate] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<FinancialData>({
    queryKey: qKey,
    queryFn: async () => {
      const res = await fetch(`/api/guardians/${encodedEmail}/financial`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load financial data");
      return res.json();
    },
  });

  async function handleSaveStatus() {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/guardians/${encodedEmail}/financial`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pendingStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: qKey });
      setEditingStatus(false);
      toast({ title: "Status updated" });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleAddComm() {
    if (!commNote.trim()) return;
    setSavingComm(true);
    try {
      const res = await fetch(`/api/guardians/${encodedEmail}/financial/communications`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: commNote, staffName: user?.name ?? null }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: qKey });
      setCommNote("");
      setShowCommForm(false);
      toast({ title: "Communication log added" });
    } catch {
      toast({ title: "Failed to save entry", variant: "destructive" });
    } finally {
      setSavingComm(false);
    }
  }

  async function handleDeleteComm(id: number) {
    if (!confirm("Delete this communication log entry?")) return;
    try {
      await fetch(`/api/guardians/${encodedEmail}/financial/communications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await queryClient.invalidateQueries({ queryKey: qKey });
      toast({ title: "Entry deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  async function handleAddPlan() {
    if (!planAmount || isNaN(parseFloat(planAmount))) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/guardians/${encodedEmail}/financial/payment-plans`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: planType,
          amount: planAmount,
          frequency: planType === "recurring" ? planFrequency : undefined,
          description: planDesc,
          expectedDate: planType === "one_off" && planExpectedDate ? planExpectedDate : undefined,
          startDate: planStartDate || undefined,
          endDate: planEndDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed");
      }
      await queryClient.invalidateQueries({ queryKey: qKey });
      setPlanAmount("");
      setPlanDesc("");
      setPlanExpectedDate("");
      setPlanStartDate("");
      setPlanEndDate("");
      setPlanType("one_off");
      setShowPlanForm(false);
      toast({ title: "Payment plan added" });
    } catch (e: any) {
      toast({ title: e.message ?? "Failed to save plan", variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeletePlan(id: number) {
    if (!confirm("Delete this payment plan?")) return;
    try {
      await fetch(`/api/guardians/${encodedEmail}/financial/payment-plans/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      await queryClient.invalidateQueries({ queryKey: qKey });
      toast({ title: "Plan deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  async function handleMarkReceived(id: number, currentlyReceived: boolean) {
    try {
      const res = await fetch(
        `/api/guardians/${encodedEmail}/financial/payment-plans/${id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ received: !currentlyReceived }),
        }
      );
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: qKey });
      toast({ title: currentlyReceived ? "Marked as unpaid" : "Payment received — recorded" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const status = data?.status ?? "active";
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;
  const communications = data?.communications ?? [];
  const plans = data?.plans ?? [];

  return (
    <div className="space-y-5">

      {/* ── Account Status ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Account Status</CardTitle>
            {!editingStatus && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => { setPendingStatus(status); setEditingStatus(true); }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editingStatus ? (
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${statusCfg.badgeClass}`}
            >
              <StatusIcon className="h-4 w-4" />
              {statusCfg.label}
            </span>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <Select
                value={pendingStatus}
                onValueChange={(v) => setPendingStatus(v as FinancialStatus)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="payment_plan">Payment Plan</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleSaveStatus} disabled={savingStatus} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {savingStatus ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingStatus(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Communication Log ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Communication Log
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowCommForm((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCommForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Recording as <span className="font-medium text-foreground">{user?.name ?? "you"}</span>
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes from conversation</Label>
                <Textarea
                  value={commNote}
                  onChange={(e) => setCommNote(e.target.value)}
                  placeholder="e.g. Called guardian to discuss outstanding balance. Agreed to follow up Friday…"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => { setShowCommForm(false); setCommNote(""); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAddComm} disabled={savingComm || !commNote.trim()}>
                  {savingComm ? "Saving…" : "Save Entry"}
                </Button>
              </div>
            </div>
          )}

          {communications.length === 0 && !showCommForm ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              No communication entries yet.
            </p>
          ) : (
            <div className="space-y-2">
              {communications.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-3 flex gap-3">
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {entry.staffName ?? "Staff"}
                      </span>
                      <span>·</span>
                      <span>{fmtMelb(entry.createdAt, "dd/MM/yyyy 'at' h:mm a")}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{entry.note}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteComm(entry.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                    title="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payment Plans ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Agreed Payment Plans
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowPlanForm((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showPlanForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              {/* Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={planType} onValueChange={(v) => setPlanType(v as "one_off" | "recurring")}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_off">One-off payment</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {planType === "recurring" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frequency</Label>
                    <Select value={planFrequency} onValueChange={setPlanFrequency}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {planType === "one_off" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Expected payment date (optional)</Label>
                  <Input
                    type="date"
                    value={planExpectedDate}
                    onChange={(e) => setPlanExpectedDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              )}
              {/* Start / End dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start date (optional)</Label>
                  <Input
                    type="date"
                    value={planStartDate}
                    onChange={(e) => setPlanStartDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End date (optional)</Label>
                  <Input
                    type="date"
                    value={planEndDate}
                    onChange={(e) => setPlanEndDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              {/* Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs">Amount ($)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={planAmount}
                  onChange={(e) => setPlanAmount(e.target.value)}
                  placeholder="e.g. 50.00"
                  className="h-8 text-sm"
                />
              </div>
              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder="e.g. Agreed on call 18 Aug…"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowPlanForm(false); setPlanAmount(""); setPlanDesc(""); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddPlan}
                  disabled={savingPlan || !planAmount}
                >
                  {savingPlan ? "Saving…" : "Save Plan"}
                </Button>
              </div>
            </div>
          )}

          {plans.length === 0 && !showPlanForm ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              No payment plans recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => {
                const isReceived = !!plan.receivedAt;
                const fmtDate = (d: string | null) => {
                  if (!d) return null;
                  const [y, m, day] = d.split("-");
                  return `${day}/${m}/${y}`;
                };
                const expectedFormatted = fmtDate(plan.expectedDate);
                const startFormatted = fmtDate(plan.startDate);
                const endFormatted = fmtDate(plan.endDate);
                return (
                  <div key={plan.id} className="border rounded-lg p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            plan.type === "recurring"
                              ? "text-blue-700 border-blue-200 bg-blue-50"
                              : "text-purple-700 border-purple-200 bg-purple-50"
                          }
                        >
                          {plan.type === "recurring"
                            ? `${FREQ_LABELS[plan.frequency ?? ""] ?? plan.frequency}`
                            : "One-off"}
                        </Badge>
                        <span className="font-semibold text-sm">
                          ${parseFloat(plan.amount).toFixed(2)}
                        </span>
                        {isReceived && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />
                            Received {fmtMelb(plan.receivedAt!, "dd/MM/yyyy")}
                          </span>
                        )}
                      </div>
                      {expectedFormatted && !isReceived && (
                        <p className="text-xs text-muted-foreground">
                          Expected: {expectedFormatted}
                        </p>
                      )}
                      {(startFormatted || endFormatted) && (
                        <p className="text-xs text-muted-foreground">
                          {startFormatted && endFormatted
                            ? `${startFormatted} – ${endFormatted}`
                            : startFormatted
                            ? `From ${startFormatted}`
                            : `Until ${endFormatted}`}
                        </p>
                      )}
                      {plan.description && (
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Added {fmtMelb(plan.createdAt, "dd/MM/yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {plan.type === "one_off" && (
                        <button
                          onClick={() => handleMarkReceived(plan.id, isReceived)}
                          title={isReceived ? "Undo — mark as unpaid" : "Mark payment as received"}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                            isReceived
                              ? "text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
                              : "text-muted-foreground border-border hover:text-green-700 hover:border-green-300 hover:bg-green-50"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {isReceived ? "Received" : "Mark Received"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Delete plan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
