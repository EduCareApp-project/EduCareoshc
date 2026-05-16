import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound, Mail, ShieldOff, ShieldCheck, Wifi, WifiOff,
  Users, UserCheck, Search, RefreshCw, Send,
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
  id: number;
  guardianEmail: string;
  guardianName: string;
  children: string[];
  isConnected: boolean;
  blockedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type SystemAccessData = {
  staff: StaffRow[];
  guardians: GuardianRow[];
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

function ComingSoonButton({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  const { toast } = useToast();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground gap-1.5"
          onClick={() => toast({ title: "Coming in the next stage", description: "User login features will be available soon." })}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Login features coming in the next stage</TooltipContent>
    </Tooltip>
  );
}

function StaffRow({ row, onBlock }: { row: StaffRow; onBlock: () => void }) {
  const isBlocked = !!row.blockedAt;
  return (
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
          <ComingSoonButton icon={KeyRound} label="Reset password" />
          <ComingSoonButton icon={Send} label="Send instructions" />
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
  );
}

function GuardianRow({ row, onBlock }: { row: GuardianRow; onBlock: () => void }) {
  const isBlocked = !!row.blockedAt;
  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors group">
      <td className="py-3 px-4">
        <div className="font-medium text-sm">{row.guardianName}</div>
        <div className="text-xs text-muted-foreground">{row.guardianEmail}</div>
      </td>
      <td className="py-3 px-4 text-xs text-muted-foreground">
        {row.children.length > 0
          ? row.children.join(", ")
          : <span className="italic">—</span>}
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
          <ComingSoonButton icon={KeyRound} label="Reset password" />
          <ComingSoonButton icon={Send} label="Send instructions" />
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
  );
}

export default function ReportsSystemAccess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/reports/system-access"],
    queryFn: fetchSystemAccess,
  });

  const blockMutation = useMutation({
    mutationFn: ({ type, id }: { type: "staff" | "guardian"; id: number }) => toggleBlock(type, id),
    onSuccess: (_, { type, id: _id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/system-access"] });
      toast({ title: "Access updated" });
    },
    onError: () => toast({ title: "Failed to update access", variant: "destructive" }),
  });

  const q = search.toLowerCase();

  const filteredStaff = (data?.staff ?? []).filter((s) =>
    !q || `${s.firstName} ${s.lastName} ${s.email} ${s.role}`.toLowerCase().includes(q)
  );
  const filteredGuardians = (data?.guardians ?? []).filter((g) =>
    !q || `${g.guardianName} ${g.guardianEmail} ${g.children.join(" ")}`.toLowerCase().includes(q)
  );

  const totalAccounts = (data?.staff.length ?? 0) + (data?.guardians.length ?? 0);
  const connectedCount = (data?.guardians ?? []).filter((g) => g.isConnected).length;
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Access</h1>
          <p className="text-muted-foreground mt-1">Manage staff and guardian accounts, connection status and access control.</p>
        </div>
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
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Role</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Last Access</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground italic">No staff found</td>
                </tr>
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
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Guardians</h2>
          <Badge variant="secondary" className="text-xs">{filteredGuardians.length}</Badge>
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
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground italic">No guardians found</td>
                </tr>
              ) : (
                filteredGuardians.map((g) => (
                  <GuardianRow
                    key={g.id}
                    row={g}
                    onBlock={() => blockMutation.mutate({ type: "guardian", id: g.id })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground pb-4">
        Password reset, login instructions, and app connection will be fully active once user login is configured in the next stage.
      </p>
    </div>
  );
}
