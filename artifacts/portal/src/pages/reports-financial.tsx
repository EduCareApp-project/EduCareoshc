import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { useListSites } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Radar,
  CheckCircle2,
  Clock,
  MessageSquare,
} from "lucide-react";
import { Link } from "wouter";
import { fmtMelb } from "@/lib/timezone";

// ── Types ─────────────────────────────────────────────────────────────────────

type SuspendedGuardian = {
  guardianEmail: string;
  guardianName: string;
  guardianPhone: string;
  childNames: string[];
};

type SiteGroup<G> = {
  siteId: number;
  siteName: string;
  guardians: G[];
};

type PaymentPlan = {
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
};

type RadarGuardian = {
  guardianEmail: string;
  guardianName: string;
  guardianPhone: string;
  reasoning: string | null;
  lastComm: { note: string; staffName: string | null; createdAt: string } | null;
  plans: PaymentPlan[];
};

type CommunicationLogEntry = {
  id: number;
  guardianEmail: string;
  guardianName: string;
  childNames: string[];
  siteNames: string[];
  note: string;
  staffName: string | null;
  createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

function fmtDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsFinancial() {
  const { isEducatorRole, ownSiteId, isAdmin } = usePermissions();
  const { data: sites } = useListSites();

  const [filterSiteId, setFilterSiteId] = useState<string>(() =>
    isEducatorRole && ownSiteId ? String(ownSiteId) : "__all__"
  );

  const siteIdParam =
    filterSiteId !== "__all__" ? parseInt(filterSiteId, 10) : null;

  const siteQuery = siteIdParam ? `?siteId=${siteIdParam}` : "";

  const { data: suspendedData, isLoading: suspendedLoading } = useQuery<
    SiteGroup<SuspendedGuardian>[]
  >({
    queryKey: ["suspended-report", siteIdParam],
    queryFn: async () => {
      const res = await fetch(`/api/guardians/financial/suspended-report${siteQuery}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const { data: radarData, isLoading: radarLoading } = useQuery<
    SiteGroup<RadarGuardian>[]
  >({
    queryKey: ["on-radar-report", siteIdParam],
    queryFn: async () => {
      const res = await fetch(`/api/guardians/financial/on-radar${siteQuery}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load on-radar data");
      return res.json();
    },
  });

  const {
    data: communicationLogData,
    isLoading: communicationLogLoading,
    isError: communicationLogError,
  } = useQuery<CommunicationLogEntry[]>({
    queryKey: ["guardian-communication-log-report", siteIdParam],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetch(`/api/guardians/financial/communication-log${siteQuery}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load communication log");
      return res.json();
    },
  });

  const isLoading = suspendedLoading || radarLoading;

  const suspendedTotal = (suspendedData ?? []).reduce((n, g) => n + g.guardians.length, 0);
  const radarTotal = (radarData ?? []).reduce((n, g) => n + g.guardians.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Accounts</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Page header + site filter */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEducatorRole ? "Suspensions Report" : "Financial Accounts"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEducatorRole
              ? "Guardians with a suspended financial status."
              : "Guardians with suspended or payment-plan financial status."}
          </p>
        </div>
        <Select value={filterSiteId} onValueChange={setFilterSiteId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All sites" />
          </SelectTrigger>
          <SelectContent>
            {!isEducatorRole && <SelectItem value="__all__">All sites</SelectItem>}
            {(sites ?? []).map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Suspended Accounts ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <h2 className="text-xl font-semibold">Suspended Accounts</h2>
          {suspendedTotal > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200 ml-1">
              {suspendedTotal} {suspendedTotal === 1 ? "account" : "accounts"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Guardians with a suspended financial status and their enrolled children.
        </p>

        {(suspendedData ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8 opacity-30 mb-1" />
              <p className="font-medium">No suspended accounts</p>
              <p className="text-sm">
                {siteIdParam
                  ? "No guardians at this site are currently suspended."
                  : "No guardians are currently suspended."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {(suspendedData ?? []).map((group) => (
              <Card key={group.siteId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {group.siteName}
                    <Badge className="ml-1 bg-red-100 text-red-800 border-red-200">
                      {group.guardians.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t bg-muted/40">
                          <th className="text-left px-6 py-2.5 font-medium text-muted-foreground">
                            Guardian
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                            Contact
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                            Children
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.guardians.map((g) => (
                          <tr
                            key={g.guardianEmail}
                            className="hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-6 py-3">
                              <Link
                                href={`/guardians/${encodeURIComponent(g.guardianEmail)}?tab=financial`}
                                className="font-medium text-primary hover:underline"
                              >
                                {g.guardianName}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                  <Mail className="h-3 w-3" />
                                  <a
                                    href={`mailto:${g.guardianEmail}`}
                                    className="hover:underline"
                                  >
                                    {g.guardianEmail}
                                  </a>
                                </div>
                                {g.guardianPhone && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                    <Phone className="h-3 w-3" />
                                    <a
                                      href={`tel:${g.guardianPhone}`}
                                      className="hover:underline"
                                    >
                                      {g.guardianPhone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {g.childNames.map((name) => (
                                  <span
                                    key={name}
                                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── On the Radar — hidden for educator/coordinator roles ──────────── */}
      {!isEducatorRole && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">On the Radar</h2>
            {radarTotal > 0 && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 ml-1">
                {radarTotal} {radarTotal === 1 ? "account" : "accounts"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Guardians currently on an agreed payment plan, with their plan details.
          </p>

          {(radarData ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Radar className="h-8 w-8 opacity-30 mb-1" />
                <p className="font-medium">No payment-plan accounts</p>
                <p className="text-sm">
                  {siteIdParam
                    ? "No guardians at this site are on a payment plan."
                    : "No guardians are currently on a payment plan."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {(radarData ?? []).map((group) => (
                <Card key={group.siteId}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {group.siteName}
                      <Badge className="ml-1 bg-blue-100 text-blue-800 border-blue-200">
                        {group.guardians.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-0">
                    <div className="divide-y">
                      {group.guardians.map((g) => (
                        <div key={g.guardianEmail} className="px-6 py-4">
                          <div className="grid grid-cols-[minmax(180px,1.5fr)_minmax(160px,1fr)_minmax(200px,1.5fr)_minmax(160px,1.5fr)] gap-x-6 items-start text-xs">
                            {/* Col 1 — name + contact */}
                            <div className="flex flex-col gap-1 min-w-0">
                              <Link
                                href={`/guardians/${encodeURIComponent(g.guardianEmail)}?tab=financial`}
                                className="font-semibold text-primary hover:underline text-sm truncate"
                              >
                                {g.guardianName}
                              </Link>
                              <span className="flex items-center gap-1 text-muted-foreground truncate">
                                <Mail className="h-3 w-3 shrink-0" />
                                <a href={`mailto:${g.guardianEmail}`} className="hover:underline truncate">
                                  {g.guardianEmail}
                                </a>
                              </span>
                              {g.guardianPhone && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  <a href={`tel:${g.guardianPhone}`} className="hover:underline">
                                    {g.guardianPhone}
                                  </a>
                                </span>
                              )}
                            </div>

                            {/* Col 2 — reason */}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              {g.reasoning ? (
                                <>
                                  <span className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Reason</span>
                                  <span className="text-foreground">{g.reasoning}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </div>

                            {/* Col 3 — last contact */}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              {g.lastComm ? (
                                <>
                                  <span className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">
                                    Last Contact · {fmtMelb(g.lastComm.createdAt, "dd/MM/yyyy")}
                                    {g.lastComm.staffName && ` · ${g.lastComm.staffName}`}
                                  </span>
                                  <span className="text-foreground line-clamp-2">{g.lastComm.note}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </div>

                            {/* Col 4 — payment plans */}
                            <div className="min-w-0">
                          {g.plans.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                              No payment plans recorded.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {g.plans.map((plan) => {
                                const isReceived = !!plan.receivedAt;
                                const dateRange =
                                  plan.startDate || plan.endDate
                                    ? plan.startDate && plan.endDate
                                      ? `${fmtDate(plan.startDate)} – ${fmtDate(plan.endDate)}`
                                      : plan.startDate
                                        ? `From ${fmtDate(plan.startDate)}`
                                        : `Until ${fmtDate(plan.endDate)}`
                                    : null;
                                return (
                                  <div
                                    key={plan.id}
                                    className={`flex flex-col gap-1 rounded-lg border px-3 py-2 text-xs min-w-[160px] ${
                                      isReceived
                                        ? "border-green-200 bg-green-50"
                                        : plan.type === "recurring"
                                          ? "border-blue-200 bg-blue-50/60"
                                          : "border-purple-200 bg-purple-50/60"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 font-medium">
                                      {plan.type === "recurring" ? (
                                        <Clock className="h-3 w-3 text-blue-600 shrink-0" />
                                      ) : isReceived ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3 text-purple-500 shrink-0" />
                                      )}
                                      <span>
                                        {plan.type === "recurring"
                                          ? FREQ_LABELS[plan.frequency ?? ""] ?? plan.frequency
                                          : "One-off"}
                                        {" · "}
                                        <span className="font-semibold">
                                          ${parseFloat(plan.amount).toFixed(2)}
                                        </span>
                                      </span>
                                    </div>
                                    {dateRange && (
                                      <span className="text-muted-foreground">{dateRange}</span>
                                    )}
                                    {plan.expectedDate && !isReceived && (
                                      <span className="text-muted-foreground">
                                        Expected {fmtDate(plan.expectedDate)}
                                      </span>
                                    )}
                                    {isReceived && (
                                      <span className="text-green-700">
                                        Received {fmtMelb(plan.receivedAt!, "dd/MM/yyyy")}
                                      </span>
                                    )}
                                    {plan.description && (
                                      <span className="text-muted-foreground italic truncate max-w-[200px]">
                                        {plan.description}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold">Guardian Communication Log</h2>
            {communicationLogData && communicationLogData.length > 0 && (
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 ml-1">
                {communicationLogData.length}{" "}
                {communicationLogData.length === 1 ? "entry" : "entries"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Information and actions recorded when communicating with guardians.
          </p>

          <Card>
            <CardContent className="p-0">
              {communicationLogLoading ? (
                <div className="space-y-3 p-6">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : communicationLogError ? (
                <div className="py-10 text-center text-destructive">
                  <p className="font-medium">Unable to load the communication log.</p>
                  <p className="text-sm mt-1">
                    Please refresh the page and try again.
                  </p>
                </div>
              ) : (communicationLogData ?? []).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto opacity-30 mb-2" />
                  <p className="font-medium">No communication log entries</p>
                  <p className="text-sm mt-1">
                    {siteIdParam
                      ? "No guardian communications are recorded for this site."
                      : "Guardian communication entries will appear here once added."}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {(communicationLogData ?? []).map((entry) => (
                    <div key={entry.id} className="px-4 py-2.5">
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                          <Link
                            href={`/guardians/${encodeURIComponent(entry.guardianEmail)}?tab=financial`}
                            className="font-semibold text-primary hover:underline shrink-0"
                          >
                            {entry.guardianName}
                          </Link>
                          <span className="break-all text-xs text-muted-foreground">
                            {entry.guardianEmail}
                          </span>
                          {entry.childNames.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              · {entry.childNames.join(", ")}
                            </span>
                          )}
                          <p className="basis-full whitespace-pre-wrap break-words leading-snug sm:basis-0 sm:min-w-0 sm:flex-1">
                            {entry.note}
                          </p>
                        </div>
                        <div className="whitespace-nowrap text-left text-xs text-muted-foreground sm:text-right">
                          {fmtMelb(entry.createdAt, "dd/MM/yyyy · HH:mm")}
                          <span className="mx-1">·</span>
                          {entry.staffName ? `Added by ${entry.staffName}` : "Added by staff"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
