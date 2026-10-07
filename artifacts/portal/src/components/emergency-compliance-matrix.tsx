import { useEffect, useId, useRef, useState } from "react";
import type { Site, ServiceComplianceReport } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Check, X, Minus, AlertTriangle, ChevronDown } from "lucide-react";
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

type CollapsedHeadings = Partial<Record<DrillType, boolean>>;

function readCollapsedHeadings(preferenceKey?: string): CollapsedHeadings {
  if (!preferenceKey) return {};
  try {
    const stored = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(
      EMERGENCY_RECORD_TYPES
        .filter(({ type }) => typeof stored[type] === "boolean")
        .map(({ type }) => [type, stored[type]]),
    );
  } catch (error) {
    console.warn("Could not restore emergency record heading preferences", error);
    return {};
  }
}

interface Props {
  sites: Site[] | undefined;
  report: ServiceComplianceReport | undefined;
  sitesLoading?: boolean;
  sitesError?: boolean;
  reportError?: boolean;
  selectedSiteId?: number;
  onRetry?: () => void;
  preferenceKey?: string;
  accountHeadings?: CollapsedHeadings | null;
  preferencesLoading?: boolean;
  preferencesError?: boolean;
  onSaveHeadings?: (headings: CollapsedHeadings) => Promise<unknown>;
}

export function EmergencyComplianceMatrix({ sites, report, sitesLoading, sitesError, reportError, selectedSiteId, onRetry, preferenceKey, accountHeadings, preferencesLoading, preferencesError, onSaveHeadings }: Props) {
  const panelId = useId();
  const [collapsed, setCollapsed] = useState<CollapsedHeadings>(() => readCollapsedHeadings(preferenceKey));
  const [saveError, setSaveError] = useState(false);
  const restored = useRef(false);

  function cacheHeadings(headings: CollapsedHeadings) {
    if (!preferenceKey) return;
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(headings));
      if (!onSaveHeadings) setSaveError(false);
    } catch (error) {
      console.warn("Could not cache emergency record heading preferences", error);
      if (!onSaveHeadings) setSaveError(true);
    }
  }

  useEffect(() => {
    if (onSaveHeadings && !preferencesLoading && preferencesError) {
      restored.current = true;
      return;
    }
    if (!onSaveHeadings || preferencesLoading || accountHeadings === undefined || restored.current) return;
    restored.current = true;
    if (accountHeadings !== null) {
      // Account settings are authoritative, not a possibly stale browser cache.
      setCollapsed(accountHeadings);
      cacheHeadings(accountHeadings);
    } else {
      const existing = readCollapsedHeadings(preferenceKey);
      if (Object.keys(existing).length > 0) {
        // One-time import of settings saved by the earlier browser-only version.
        void onSaveHeadings(existing).catch(() => setSaveError(true));
      }
    }
  }, [accountHeadings, preferencesLoading, preferencesError, onSaveHeadings, preferenceKey]);

  function toggleHeading(type: DrillType) {
    const next = { ...collapsed, [type]: !collapsed[type] };
    setCollapsed(next);
    cacheHeadings(next);
    if (onSaveHeadings) {
      void onSaveHeadings({ [type]: next[type] })
        .then(() => setSaveError(false))
        .catch(() => setSaveError(true));
    }
  }

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
        {preferencesLoading && <p role="status" className="text-xs text-muted-foreground">Loading saved heading settings…</p>}
        {preferencesError && (
          <p role="status" className="text-xs text-amber-700">Your account’s heading settings couldn’t be loaded. Showing the settings saved in this browser.</p>
        )}
        {saveError && (
          <p role="status" className="text-xs text-amber-700">
            {onSaveHeadings ? "Your heading settings couldn’t be saved to your account. They may not be remembered next time." : "Your browser couldn’t save these heading settings. They may reset when you reload."}
          </p>
        )}
        {active.length === 0 && <p data-testid="emergency-matrix-empty" className="text-sm text-muted-foreground">No active services found.</p>}
        {active.length > 0 && EMERGENCY_RECORD_TYPES.map(({ type, label }) => (
          <section key={type} data-testid={`emergency-row-${type}`} aria-label={label}>
            <h3 className="text-sm font-semibold mb-1.5">
              <button
                type="button"
                disabled={preferencesLoading}
                aria-expanded={!collapsed[type]}
                aria-controls={`${panelId}-${type}`}
                onClick={() => toggleHeading(type)}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-1 text-left hover:bg-muted/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                {label}
                <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${collapsed[type] ? "-rotate-90" : ""}`} />
              </button>
            </h3>
            <div
              id={`${panelId}-${type}`}
              hidden={!!collapsed[type]}
              className={`${collapsed[type] ? "hidden" : "flex"} gap-2 overflow-x-auto pb-1`}
            >
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
