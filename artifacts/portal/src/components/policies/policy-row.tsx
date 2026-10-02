import { useState } from "react";
import {
  useAcknowledgePolicy, useAddPolicyDistribution, useUpdatePolicy,
  useGetPolicyAcknowledgments, getGetPolicyAcknowledgmentsQueryKey, getListPoliciesQueryKey,
} from "@workspace/api-client-react";
import type { Policy, Staff } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Paperclip, ChevronDown, ChevronUp, CheckCircle2, Clock, Pencil, Trash2, Users,
  Power, UserPlus, MinusCircle, History,
} from "lucide-react";
import { fmtMelb } from "@/lib/timezone";
import { useToast } from "@/hooks/use-toast";

export const NOTIFY_ROLE_OPTIONS = [
  { value: "educational_leader", label: "Educational Leader" },
  { value: "coordinator", label: "Coordinator" },
  { value: "educator", label: "Educator" },
];
export function roleLabel(role: string) {
  return NOTIFY_ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

const PILL = "flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-0.5 shrink-0 border";

export function PolicyRow({
  policy, viewerId, allStaff, canManage, onEdit, onDelete,
}: {
  policy: Policy;
  viewerId: number | null;
  allStaff: Staff[];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ackMutation = useAcknowledgePolicy();
  const distMutation = useAddPolicyDistribution();
  const statusMutation = useUpdatePolicy();
  const [expanded, setExpanded] = useState(false);

  const { data: acks, isLoading: acksLoading, isError: acksError } = useGetPolicyAcknowledgments(policy.id, {
    query: {
      queryKey: getGetPolicyAcknowledgmentsQueryKey(policy.id),
      enabled: expanded || viewerId != null,
      staleTime: 30_000,
    },
  });

  const roles = policy.notifyRoles ? policy.notifyRoles.split(",").map((r) => r.trim()).filter(Boolean) : [];
  const distributed = policy.distributedStaffIds;
  const isDistributed = viewerId != null && distributed.includes(viewerId);
  const viewerAcks = viewerId != null
    ? (acks ?? []).filter((a) => a.staffId === viewerId)
        .sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt))
    : [];
  const currentAck = viewerAcks.find((a) => a.policyVersion === policy.versionNumber);
  const latestAck = viewerAcks[0];
  const everSigned = viewerId != null && (policy.acknowledgedStaffIds.includes(viewerId) || viewerAcks.length > 0);
  const acksReady = !acksLoading && !acksError && acks !== undefined;
  const canAckSelf = policy.isActive && isDistributed && !currentAck && acksReady
    && viewerId != null;

  function refreshAck() {
    queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPolicyAcknowledgmentsQueryKey(policy.id) });
  }
  function acknowledge(staffId: number) {
    ackMutation.mutate({ id: policy.id, data: { staffId } }, {
      onSuccess: () => { refreshAck(); toast({ title: "Acknowledgement recorded" }); },
      onError: () => toast({ title: "Failed to record acknowledgement", variant: "destructive" }),
    });
  }
  function addToDistribution(staffId: number) {
    distMutation.mutate({ id: policy.id, data: { staffId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() });
        toast({ title: "Added to distribution", description: "Not signed on their behalf." });
      },
      onError: () => toast({ title: "Could not add to distribution", variant: "destructive" }),
    });
  }
  function setActive(isActive: boolean) {
    statusMutation.mutate({ id: policy.id, data: { isActive } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() });
        toast({ title: isActive ? "Policy reactivated" : "Policy deactivated" });
      },
      onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
    });
  }

  const staffRows = distributed
    .map((id) => allStaff.find((s) => s.id === id))
    .filter((s): s is Staff => !!s);
  const allAcks = acks ?? [];
  const ackedCount = staffRows.filter((s) => allAcks.some((a) => a.staffId === s.id && a.policyVersion === policy.versionNumber)).length;

  let badge: React.ReactNode = null;
  if (viewerId != null) {
    if (!policy.isActive) {
      if (everSigned) {
        badge = (
          <span data-testid={`badge-signed-${policy.id}`} className={`${PILL} text-green-800 bg-green-50 border-green-200`}>
            <History className="h-3 w-3" />
            {latestAck
              ? `Signed ${currentAck ? "" : `v${latestAck.policyVersion} `}${fmtMelb(latestAck.acknowledgedAt, "dd/MM/yyyy")}`.replace("  ", " ")
              : "Signed"}
          </span>
        );
      }
    } else if (acksLoading) {
      badge = <span className={`${PILL} text-muted-foreground bg-muted`}>Checking…</span>;
    } else if (acksError) {
      badge = <span className={`${PILL} text-destructive border-destructive/30`}>Status unavailable</span>;
    } else if (currentAck) {
      badge = <span data-testid={`badge-ack-${policy.id}`} className={`${PILL} text-green-700 bg-green-50 border-green-200`}><CheckCircle2 className="h-3 w-3" />Acknowledged</span>;
    } else if (isDistributed) {
      badge = <span data-testid={`badge-pending-${policy.id}`} className={`${PILL} text-amber-700 bg-amber-50 border-amber-200`}><Clock className="h-3 w-3" />Pending</span>;
    } else {
      badge = <span data-testid={`badge-unassigned-${policy.id}`} className={`${PILL} text-muted-foreground bg-muted border-border`}><MinusCircle className="h-3 w-3" />Not assigned</span>;
    }
  }

  return (
    <div className={`border-b last:border-b-0 ${policy.isActive ? "" : "bg-muted/30"}`} data-testid={`row-policy-${policy.id}`}>
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpanded((v) => !v)}>
        {policy.policyNumber != null && (
          <span className="text-xs font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0 tabular-nums min-w-[2.2rem] text-center">
            {String(policy.policyNumber).padStart(2, "0")}
          </span>
        )}
        <span className={`flex-1 min-w-[10rem] text-sm font-medium truncate ${policy.isActive ? "" : "text-muted-foreground"}`}>{policy.title}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">v{policy.versionNumber}</Badge>
        {!policy.isActive && <Badge variant="secondary" data-testid={`badge-inactive-${policy.id}`} className="text-[10px] px-1.5 shrink-0">Inactive</Badge>}
        {policy.documentPath && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
        {badge}

        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {canManage && viewerId != null && policy.isActive && !isDistributed && (
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 mr-1" data-testid={`button-add-distribution-${policy.id}`}
              disabled={distMutation.isPending} onClick={() => addToDistribution(viewerId)}>
              <UserPlus className="h-3 w-3 mr-1" />{distMutation.isPending ? "Adding…" : "Add to distribution"}
            </Button>
          )}
          {canManage && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Edit policy" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground" data-testid={`button-status-${policy.id}`} disabled={statusMutation.isPending}>
                    <Power className="h-3 w-3 mr-1" />{policy.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{policy.isActive ? "Deactivate policy?" : "Reactivate policy?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {policy.isActive
                        ? `"${policy.title}" will stop accepting new acknowledgements and distribution. Version, recipients and acknowledgement history are preserved, and you can reactivate it at any time.`
                        : `"${policy.title}" will accept acknowledgements and distribution again. Version, recipients and history are unchanged.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction data-testid={`button-confirm-status-${policy.id}`} onClick={() => setActive(!policy.isActive)}>
                      {policy.isActive ? "Deactivate" : "Reactivate"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete policy"><Trash2 className="h-3 w-3" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete policy?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete "{policy.title}" and all acknowledgement records. To keep history, deactivate it instead.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <button aria-label="Toggle details" onClick={() => setExpanded((v) => !v)} className="text-muted-foreground hover:text-foreground p-1 ml-0.5">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/10 px-5 py-5 space-y-5">
          {policy.description && <p className="text-sm text-muted-foreground">{policy.description}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {policy.version && <span>Version label: {policy.version}</span>}
            {policy.lastReviewedAt && <span>Last reviewed: {policy.lastReviewedAt.slice(0, 10)}</span>}
            {roles.length > 0 && <span>Originally selected roles: {roles.map(roleLabel).join(", ")}</span>}
            <span>{distributed.length} on saved distribution</span>
          </div>

          {acksError && <p className="text-sm text-destructive">Could not load acknowledgements.</p>}

          {viewerId != null && canAckSelf && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 text-sm text-amber-800 font-medium"><Clock className="h-4 w-4 shrink-0" />Not yet acknowledged for v{policy.versionNumber}.</div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" disabled={ackMutation.isPending} onClick={() => acknowledge(viewerId)}>Acknowledge</Button>
            </div>
          )}
          {viewerId != null && currentAck && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" />Acknowledged on {fmtMelb(currentAck.acknowledgedAt, "dd/MM/yyyy")}.
            </div>
          )}

          {policy.content ? (
            <div className="prose prose-sm max-w-none text-sm leading-relaxed border rounded-lg p-4 bg-background" dangerouslySetInnerHTML={{ __html: policy.content }} />
          ) : policy.documentPath ? (
            <a href={`/api/storage${policy.documentPath}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4 bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
              <Paperclip className="h-4 w-4" />{policy.documentName ?? "Open document"}
            </a>
          ) : <p className="text-sm text-muted-foreground italic">No content added yet.</p>}

          {canManage && staffRows.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" />Staff acknowledgements — {ackedCount} of {staffRows.length} for v{policy.versionNumber}
                </div>
                <div className="grid gap-1">
                  {staffRows.map((s) => {
                    const ack = allAcks.find((a) => a.staffId === s.id && a.policyVersion === policy.versionNumber);
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-muted/30 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          {ack ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" /> : <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          <span className="truncate">{s.firstName} {s.lastName}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{roleLabel(s.role)}</span>
                        </div>
                        {ack ? (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtMelb(ack.acknowledgedAt, "dd/MM/yyyy")}</span>
                        ) : policy.isActive ? (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" disabled={ackMutation.isPending} onClick={() => acknowledge(s.id)}>Record</Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
