import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound, ShieldOff, ShieldCheck, Wifi, WifiOff,
  Users, UserCheck, Search, Send,
} from "lucide-react";

type StaffRow = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  isConnected: boolean;
  blockedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type GuardianRow = {
  id: number | null;
  guardianEmail: string;
  guardianName: string;
  children: string[];
  siteIds: number[];
  isConnected: boolean;
  blockedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
};

type SiteOption = { id: number; name: string };

type SystemAccessData = {
  staff: StaffRow[];
  guardians: GuardianRow[];
  sites: SiteOption[];
};

const ROLE_LABELS: Record<string, string> = {
  director: "Director",
  educator: "Educator",
  assistant: "Assistant",
  trainee: "Trainee",
  admin: "Admin",
  coordinator: "Coordinator",
  educational_leader: "Educational Leader",
  room_leader: "Room Leader",
};

async function fetchSystemAccess(): Promise<SystemAccessData> {
  const res = await fetch("/api/reports/system-access");
  if (!res.ok) throw new Error("Failed to load system access data");
  return res.json();
}

async function toggleBlock(type: "staff" | "guardian", id: number) {
  const res = await fetch(`/api/reports/system-access/${type}/${id}/block`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to update access");
  return res.json();
}

async function sendInstructions(type: "staff" | "guardian", id: number) {
  const res = await fetch(`/api/reports/system-access/${type}/${id}/send-instructions`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to send instructions");
  return data;
}

async function provisionAndSend(email: string) {
  const res = await fetch("/api/reports/system-access/guardian/provision-and-send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to send instructions");
  return data;
}

async function setPassword(type: "staff" | "guardian", id: number, password: string) {
  const res = await fetch(`/api/reports/system-access/${type}/${id}/set-password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to set password");
  return data;
}

function ConnectedBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <Wifi className="h-3 w-3" /> Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
      <WifiOff className="h-3 w-3" /> Not set up
    </span>
  );
}

function BlockedBadge({ blockedAt }: { blockedAt: string | null }) {
  if (!blockedAt) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <ShieldOff className="h-3 w-3" /> Blocked
    </span>
  );
}

function SetPasswordDialog({
  open,
  onClose,
  label,
  onSave,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  onSave: (pw: string) => void;
  isPending: boolean;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function handleSave() {
    setErr(null);
    if (pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (pw !== confirm) { setErr("Passwords do not match."); return; }
    onSave(pw);
  }

  function handleClose() {
    setPw(""); setConfirm(""); setErr(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Password — {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label>New password</Label>
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1">
            <Label>Confirm password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Set Password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StaffRow({ row, onBlock }: { row: StaffRow; onBlock: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pwDialog, setPwDialog] = useState(false);
  const isBlocked = !!row.blockedAt;
  const canSendInstructions = !!row.email && !isBlocked;

  const pwMutation = useMutation({
    mutationFn: (pw: string) => setPassword("staff", row.id, pw),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/system-access"] });
      toast({ title: "Password set", description: `${row.firstName} ${row.lastName} can now log in.` });
      setPwDialog(false);
    },
    onError: (e: Error) => toast({ title: "Failed to set password", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendInstructions("staff", row.id),
    onSuccess: () => toast({ title: "Instructions sent", description: `Login instructions emailed to ${row.email}.` }),
    onError: (e: Error) => toast({ title: "Failed to send instructions", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors group">
        <td className="py-3 px-4">
          <div className="font-medium text-sm">{row.firstName} {row.lastName}</div>
          <div className="text-xs text-muted-foreground">{row.email}</div>
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
          {ROLE_LABELS[row.role] ?? row.role}
        </td>
        <td className="py-3 px-4">
          <div className="flex flex-wrap gap-1.5">
            <ConnectedBadge connected={row.isConnected} />
            <BlockedBadge blockedAt={row.blockedAt} />
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
          {row.lastLoginAt
            ? new Date(row.lastLoginAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
            : <span className="italic text-muted-foreground/60">Never</span>}
        </td>
        <td className="py-3 px-2">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setPwDialog(true)}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {row.isConnected ? "Reset password" : "Set password"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{row.isConnected ? "Change this staff member's password" : "Create a login password"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 text-muted-foreground"
                  disabled={!canSendInstructions || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendMutation.isPending ? "Sending…" : "Send instructions"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!row.email
                  ? "No email address on record"
                  : isBlocked
                  ? "Unblock this account before sending instructions"
                  : "Email login instructions to this staff member"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-7 text-xs gap-1.5 ${isBlocked ? "text-emerald-700 hover:text-emerald-900" : "text-red-600 hover:text-red-800"}`}
                  onClick={onBlock}
                >
                  {isBlocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                  {isBlocked ? "Unblock" : "Block"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isBlocked ? "Restore access" : "Block access to the app"}</TooltipContent>
            </Tooltip>
          </div>
        </td>
      </tr>
      <SetPasswordDialog
        open={pwDialog}
        onClose={() => setPwDialog(false)}
        label={`${row.firstName} ${row.lastName}`}
        onSave={(pw) => pwMutation.mutate(pw)}
        isPending={pwMutation.isPending}
      />
    </>
  );
}

function GuardianRow({ row, onBlock }: { row: GuardianRow; onBlock: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pwDialog, setPwDialog] = useState(false);
  const isProvisioned = row.id != null;
  const isBlocked = !!row.blockedAt;
  const canSendInstructions = !!row.guardianEmail && !isBlocked;

  const pwMutation = useMutation({
    mutationFn: (pw: string) => setPassword("guardian", row.id!, pw),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/system-access"] });
      toast({ title: "Password set", description: `${row.guardianName} can now log in to the family portal.` });
      setPwDialog(false);
    },
    onError: (e: Error) => toast({ title: "Failed to set password", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      isProvisioned
        ? sendInstructions("guardian", row.id!)
        : provisionAndSend(row.guardianEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/system-access"] });
      toast({ title: "Instructions sent", description: `Login instructions emailed to ${row.guardianEmail}.` });
    },
    onError: (e: Error) => toast({ title: "Failed to send instructions", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors group">
        <td className="py-3 px-4">
          <Link
            href={`/guardians/${encodeURIComponent(row.guardianEmail)}`}
            className="font-medium text-sm hover:underline"
          >
            {row.guardianName}
          </Link>
          <div className="text-xs text-muted-foreground">{row.guardianEmail}</div>
        </td>
        <td className="py-3 px-4 text-xs text-muted-foreground">
          {row.children.length > 0 ? row.children.join(", ") : <span className="italic">—</span>}
        </td>
        <td className="py-3 px-4">
          <div className="flex flex-wrap gap-1.5">
            {!isProvisioned
              ? <Badge variant="outline" className="text-xs text-muted-foreground">No account</Badge>
              : <><ConnectedBadge connected={row.isConnected} /><BlockedBadge blockedAt={row.blockedAt} /></>
            }
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
          {row.lastLoginAt
            ? new Date(row.lastLoginAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
            : <span className="italic text-muted-foreground/60">Never</span>}
        </td>
        <td className="py-3 px-2">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5"
                  disabled={!isProvisioned}
                  onClick={() => setPwDialog(true)}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {row.isConnected ? "Reset password" : "Set password"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{!isProvisioned ? "Guardian has no portal account yet" : row.isConnected ? "Change this guardian's password" : "Create a login password"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 text-muted-foreground"
                  disabled={!canSendInstructions || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendMutation.isPending ? "Sending…" : "Send instructions"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!row.guardianEmail
                  ? "No email address on record"
                  : isBlocked
                  ? "Unblock this account before sending instructions"
                  : !isProvisioned
                  ? "Create an account and email login instructions"
                  : "Email login instructions to this guardian"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-7 text-xs gap-1.5 ${isBlocked ? "text-emerald-700 hover:text-emerald-900" : "text-red-600 hover:text-red-800"}`}
                  disabled={!isProvisioned}
                  onClick={onBlock}
                >
                  {isBlocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                  {isBlocked ? "Unblock" : "Block"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{!isProvisioned ? "Guardian has no portal account yet" : isBlocked ? "Restore access" : "Block access to the family portal"}</TooltipContent>
            </Tooltip>
          </div>
        </td>
      </tr>
      <SetPasswordDialog
        open={pwDialog}
        onClose={() => setPwDialog(false)}
        label={row.guardianName}
        onSave={(pw) => pwMutation.mutate(pw)}
        isPending={pwMutation.isPending}
      />
    </>
  );
}

export default function ReportsSystemAccess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/reports/system-access"],
    queryFn: fetchSystemAccess,
  });

  const blockMutation = useMutation({
    mutationFn: ({ type, id }: { type: "staff" | "guardian"; id: number }) => toggleBlock(type, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/system-access"] });
      toast({ title: "Access updated" });
    },
    onError: () => toast({ title: "Failed to update access", variant: "destructive" }),
  });

  const q = search.toLowerCase();
  const filteredStaff = (data?.staff ?? []).filter(
    (s) => !q || `${s.firstName} ${s.lastName} ${s.email} ${s.role}`.toLowerCase().includes(q)
  );
  const filteredGuardians = (data?.guardians ?? []).filter((g) => {
    if (q && !`${g.guardianName} ${g.guardianEmail} ${g.children.join(" ")}`.toLowerCase().includes(q)) return false;
    if (siteFilter !== "all" && !g.siteIds.includes(Number(siteFilter))) return false;
    return true;
  });

  const totalAccounts = (data?.staff.length ?? 0) + (data?.guardians.length ?? 0);
  const connectedCount =
    (data?.staff ?? []).filter((s) => s.isConnected).length +
    (data?.guardians ?? []).filter((g) => g.isConnected).length;
  const blockedCount =
    (data?.staff ?? []).filter((s) => s.blockedAt).length +
    (data?.guardians ?? []).filter((g) => g.blockedAt).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold tracking-tight">System Access</h1></div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Access</h1>
        <p className="text-muted-foreground mt-1">Manage staff and guardian accounts, connection status and access control.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2.5">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAccounts}</p>
                <p className="text-xs text-muted-foreground">Total accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2.5">
                <Wifi className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{connectedCount}</p>
                <p className="text-xs text-muted-foreground">Connected to app</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2.5">
                <ShieldOff className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{blockedCount}</p>
                <p className="text-xs text-muted-foreground">Blocked accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email…"
          className="pl-9"
        />
      </div>

      {/* Staff section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Staff</h2>
          <Badge variant="secondary" className="text-xs">{filteredStaff.length}</Badge>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name / Email</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Last Access</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground italic">No staff found</td></tr>
              ) : (
                filteredStaff.map((s) => (
                  <StaffRow
                    key={s.id}
                    row={s}
                    onBlock={() => blockMutation.mutate({ type: "staff", id: s.id })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guardians section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Guardians</h2>
          <Badge variant="secondary" className="text-xs">{filteredGuardians.length}</Badge>
          {(data?.sites ?? []).length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="guardian-site-filter" className="text-xs text-muted-foreground whitespace-nowrap">
                Filter by service:
              </label>
              <select
                id="guardian-site-filter"
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All services</option>
                {(data?.sites ?? []).map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name / Email</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked Children</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Last Access</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredGuardians.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground italic">No guardians found</td></tr>
              ) : (
                filteredGuardians.map((g) => (
                  <GuardianRow
                    key={g.guardianEmail}
                    row={g}
                    onBlock={() => g.id != null && blockMutation.mutate({ type: "guardian", id: g.id })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
