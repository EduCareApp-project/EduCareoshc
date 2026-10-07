import type { Site, ServiceComplianceReport } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Check, X, Minus, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type StatusItem = ServiceComplianceReport["emergencyStatuses"][number];
type DrillType = StatusItem["drillType"];

export const EMERGENCY_RECORD_TYPES: { type: DrillType; label: string }[] = [
  { type: "evacuation", label: "Safety Evacuation Drill" },
  { type: "lockdown", label: "Lockdown Drill" },
  { type: "shelter_in_place", label: "Shelter in Place Drill" },
  { type: "other", label: "Other Emergency Record" },
];

const fmt = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yyyy") : null);

interface Props {
  sites: Site[] | undefined;
  report: ServiceComplianceReport | undefined;
  sitesLoading?: boolean;
  sitesError?: boolean;
  reportError?: boolean;
  selectedSiteId?: number;
  onRetry?: () => void;
}

export function EmergencyComplianceMatrix({ sites, report, sitesLoading, sitesError, reportError, selectedSiteId, onRetry }: Props) {
  if (sitesLoading) {
    return (
      <div data-testid="emergency-matrix-loading" className="space-y-3">
        {EMERGENCY_RECORD_TYPES.map((r) => <Skeleton key={r.type} className="h-[72px] w-full" />)}
      </div>
    );
  }
  if (sitesError || reportError || !report || !sites) {
    return (
      <div role="alert" data-testid="emergency-matrix-error" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
        {sitesError ? "Services could not be loaded." : "Emergency record compliance could not be loaded."} Results are not shown to avoid misleading information.
        {onRetry && <button type="button" onClick={onRetry} className="ml-2 underline font-medium">Retry</button>}
      </div>
    );
  }

  const active = sites.filter((s) => s.status === "active" && (selectedSiteId === undefined || s.id === selectedSiteId));

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        <p data-testid="emergency-matrix-legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" /> Current or expiring (still valid)</span>
          <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5 text-red-600" /> Expired</span>
          <span className="inline-flex items-center gap-1"><Minus className="h-3.5 w-3.5" /> No record</span>
        </p>
        {active.length === 0 && <p data-testid="emergency-matrix-empty" className="text-sm text-muted-foreground">No active services found.</p>}
        {active.length > 0 && EMERGENCY_RECORD_TYPES.map(({ type, label }) => (
          <section key={type} data-testid={`emergency-row-${type}`} aria-label={label}>
            <h3 className="text-sm font-semibold mb-1.5">{label}</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {active.map((site) => {
                const st = report.emergencyStatuses.find((e) => e.siteId === site.id && e.drillType === type);
                const status = st?.status ?? "missing";
                const code = site.identifier;
                const last = fmt(st?.lastConducted);
                const due = fmt(st?.nextDue);
                const statusText = status === "current" ? "Current" : status === "expiring" ? "Expiring soon" : status === "expired" ? "Expired" : "No record";
                const parts = [`${site.name}`, label, statusText];
                if (last) parts.push(`Last conducted ${last}`);
                if (due) parts.push(`${status === "expired" ? "Was due" : "Next due"} ${due}`);
                if (!code) parts.push("Code not assigned");
                const text = parts.join(". ");
                const tone =
                  status === "expired" ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                  : status === "missing" ? "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                  : "border-green-300 bg-green-50 text-green-900 hover:bg-green-100";
                return (
                  <Tooltip key={site.id}>
                    <TooltipTrigger asChild>
                      <div
                        tabIndex={0}
                        role="img"
                        title={text}
                        aria-label={text}
                        data-testid={`emergency-tile-${type}-${site.id}`}
                        data-status={status}
                        className={`relative shrink-0 h-[68px] w-[68px] rounded-md border flex flex-col items-center justify-center gap-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${tone}`}
                      >
                        {status === "expired" ? <X className="h-4 w-4 text-red-600" data-testid="icon-cross" />
                          : status === "missing" ? <Minus className="h-4 w-4" data-testid="icon-none" />
                          : <Check className="h-4 w-4 text-green-600" data-testid="icon-tick" />}
                        <span className="font-mono text-sm font-semibold leading-none">{code ?? "—"}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs space-y-0.5">
                      <p className="font-semibold">{site.name}</p>
                      <p>{label}: {statusText}</p>
                      {!code && <p>Code not assigned</p>}
                      {last && <p>Last conducted: {last}</p>}
                      {due && <p>{status === "expired" ? "Was due" : "Next due"}: {due}</p>}
                      {status === "expiring" && <p className="inline-flex items-center gap-1 font-medium"><AlertTriangle className="h-3 w-3" /> Expiring soon</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </TooltipProvider>
  );
}
