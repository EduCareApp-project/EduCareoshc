import {
  useGetGuardian,
  useResetGuardianPassword,
  useListGuardianBehaviouralNotifications,
  getListGuardianBehaviouralNotificationsQueryKey,
  useListChildren,
  useUpdateChild,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Mail,
  Phone,
  Baby,
  KeyRound,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  MessageSquareWarning,
  ClipboardList,
  UserCheck,
  Plus,
  Trash2,
  Pencil,
  Send,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";

interface ApprovedPickup { id: string; fullName: string; phone: string; relationship: string; }

function randomId() { return Math.random().toString(36).slice(2); }
const EMPTY_PU = { fullName: "", phone: "", relationship: "" };

function PickupsSection({ guardian }: { guardian: { childIds: number[]; childNames: string[] } }) {
  const { isFullAccess } = usePermissions();
  const canEdit = isFullAccess;
  const { data: allChildren } = useListChildren();
  const updateChild = useUpdateChild();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_PU);

  const children = (allChildren ?? []).filter((c) => guardian.childIds.includes(c.id));

  function pickups(child: (typeof children)[number]): ApprovedPickup[] {
    return (child.approvedPickups as unknown as ApprovedPickup[]) ?? [];
  }

  function save(childId: number, next: ApprovedPickup[]) {
    updateChild.mutate(
      { id: childId, data: { approvedPickups: next } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: "Saved" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  function handleAdd(child: (typeof children)[number]) {
    if (!form.fullName.trim()) return;
    const next = [...pickups(child), { id: Math.random().toString(36).slice(2), ...form }];
    save(child.id, next);
    setForm(EMPTY_PU);
    setAddingFor(null);
  }

  function handleRemove(child: (typeof children)[number], id: string) {
    save(child.id, pickups(child).filter((p) => p.id !== id));
  }

  return (
    <div className="bg-card border rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-emerald-600" />
          Approved Pick-Ups
        </h2>
        <p className="text-xs text-muted-foreground mt-1">People authorised to collect this guardian's children from the centre.</p>
      </div>

      {children.map((child) => {
        const pu = pickups(child);
        return (
          <div key={child.id} className="space-y-2">
            <p className="text-sm font-medium">{child.firstName} {child.lastName}</p>
            {pu.length === 0 && <p className="text-xs text-muted-foreground italic">No approved pick-ups recorded.</p>}
            <div className="space-y-1.5">
              {pu.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm border rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium">Pick Up {i + 1}: {p.fullName}</span>
                    <span className="text-muted-foreground ml-2">({p.relationship}) · {p.phone}</span>
                  </div>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRemove(child, p.id)}
                      disabled={updateChild.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && addingFor === child.id ? (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-medium">New Pick Up {pu.length + 1}</p>
                <div className="grid sm:grid-cols-3 gap-2">
                  <div><Label className="text-xs">Full Name</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Full name" className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="04xx xxx xxx" className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Relationship</Label><Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="Aunt, Uncle…" className="h-8 text-sm" /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAdd(child)} disabled={!form.fullName.trim() || updateChild.isPending}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingFor(null); setForm(EMPTY_PU); }}>Cancel</Button>
                </div>
              </div>
            ) : canEdit ? (
              <Button size="sm" variant="outline" onClick={() => { setAddingFor(child.id); setForm(EMPTY_PU); }}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Pick Up
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function GuardianDetail() {
  const { email: encodedEmail } = useParams<{ email: string }>();
  const email = decodeURIComponent(encodedEmail ?? "");

  const { data: guardian, isLoading } = useGetGuardian(encodedEmail ?? "");
  const { data: behaviouralLogs = [], isLoading: logsLoading } = useListGuardianBehaviouralNotifications(
    encodedEmail ?? "",
    { query: { enabled: !!encodedEmail, queryKey: getListGuardianBehaviouralNotificationsQueryKey(encodedEmail ?? "") } }
  );
  const resetMutation = useResetGuardianPassword();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [welcomeSending, setWelcomeSending] = useState(false);
  const [welcomeSent, setWelcomeSent] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!guardian) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-muted-foreground">Guardian not found.</p>
        <Link href="/guardians">
          <Button variant="outline" className="mt-4">Back to Guardians</Button>
        </Link>
      </div>
    );
  }

  async function handleSendWelcomeEmail() {
    setWelcomeSending(true);
    try {
      const res = await fetch(`/api/guardians/${encodedEmail}/send-welcome-email`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      setWelcomeSent(true);
      toast({ title: "Welcome email sent", description: `Sent to ${email}` });
      setTimeout(() => setWelcomeSent(false), 4000);
    } catch {
      toast({ title: "Failed to send email", variant: "destructive" });
    } finally {
      setWelcomeSending(false);
    }
  }

  async function handleResetPassword() {
    const result = await resetMutation.mutateAsync({
      email: encodedEmail ?? "",
      data: { newPassword: customPassword.trim() || undefined },
    });
    setNewPassword(result.newPassword);
    setShowNewPassword(true);
    setCustomPassword("");
    await queryClient.invalidateQueries();
    toast({ title: "Password set", description: "Copy the new password — it won't be shown again." });
  }

  function copyPassword() {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/guardians">
        <Button variant="ghost" size="sm" className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Guardians
        </Button>
      </Link>

      {/* Profile card */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
            {initials(guardian.guardianName)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{guardian.guardianName}</h1>
            <div className="flex flex-col gap-1.5 mt-2">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${guardian.guardianEmail}`} className="hover:underline">{guardian.guardianEmail}</a>
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={`tel:${guardian.guardianPhone}`} className="hover:underline">{guardian.guardianPhone}</a>
              </p>
            </div>
          </div>
          <div>
            {guardian.hasPassword ? (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <ShieldCheck className="h-3.5 w-3.5" />
                Account active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                <ShieldOff className="h-3.5 w-3.5" />
                No account
              </span>
            )}
          </div>
        </div>

        {/* Linked children */}
        <div className="mt-5 pt-4 border-t">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
            <Baby className="h-3.5 w-3.5" />
            Linked Children
          </p>
          <div className="flex flex-wrap gap-2">
            {guardian.childNames.map((name, i) => (
              <Link key={i} href={`/children/${guardian.childIds[i]}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-primary/10 transition-colors text-sm">
                  {name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Parent App Access */}
      <div className="bg-card border rounded-xl p-6 space-y-5">
        <div className="border-b pb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Parent App Access
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Set login credentials for this guardian to access the parent-facing app.
          </p>
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label>Username</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-mono bg-muted px-3 py-1.5 rounded-md border">{guardian.guardianEmail}</p>
            <span className="text-xs text-muted-foreground">auto-set from email</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto gap-1.5"
              onClick={handleSendWelcomeEmail}
              disabled={welcomeSending}
            >
              {welcomeSent
                ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Sent</>
                : <><Send className={`h-3.5 w-3.5 ${welcomeSending ? "animate-pulse" : ""}`} /> Send Welcome Email</>
              }
            </Button>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label>Password</Label>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {guardian.hasPassword ? "A password has been set." : "No password set."}
            </p>

            {/* Custom password input */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">New password (leave blank to auto-generate)</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showCustomPassword ? "text" : "password"}
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Enter a password…"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Toggle visibility"
                  >
                    {showCustomPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={resetMutation.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${resetMutation.isPending ? "animate-spin" : ""}`} />
                  {guardian.hasPassword ? "Reset" : "Set Password"}
                </Button>
              </div>
            </div>

            {newPassword && (
              <div className="border rounded-lg p-4 bg-amber-50 border-amber-200 space-y-2">
                <p className="text-xs font-semibold text-amber-800">
                  Password set — copy it now, it won't be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-white border rounded-md px-3 py-2">
                    <p className="flex-1 text-sm font-mono tracking-wider">
                      {showNewPassword ? newPassword : "•".repeat(newPassword.length)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle visibility"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button size="sm" variant="outline" onClick={copyPassword}>
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approved Pick-ups */}
      <PickupsSection guardian={guardian} />

      {/* Behavioural Email Log */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-amber-500" />
              Behavioural Email Log
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              All behavioural notifications sent to {guardian.guardianName} for their enrolled children.
            </p>
          </div>
          {guardian.childIds.length > 0 && (
            <Link href={`/children/${guardian.childIds[0]}?tab=behaviour`}>
              <Button size="sm" variant="outline">Send Email</Button>
            </Link>
          )}
        </div>

        {logsLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : behaviouralLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mb-2 opacity-25" />
            <p className="text-sm font-medium">No behavioural notifications sent yet</p>
            <p className="text-xs mt-1">Go to a child's profile to send a behavioural email.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {behaviouralLogs.map(n => (
              <Card key={n.id} className="overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-sm">{format(new Date(n.sentAt), "dd/MM/yyyy 'at' h:mm a")}</CardTitle>
                      {n.childName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Re: <Link href={`/children/${n.childId}`} className="hover:underline text-foreground">{n.childName}</Link>
                        </p>
                      )}
                    </div>
                    {n.sentByStaffName && (
                      <span className="text-xs text-muted-foreground">Sent by {n.sentByStaffName}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Behaviour</p>
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
      </div>
    </div>
  );
}
