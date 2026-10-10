import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subMonths, parseISO, isValid } from "date-fns";
import { useGetDashboardUtilisation } from "@workspace/api-client-react";
import type { UtilisationSite } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { melbourneDateStr } from "@/lib/timezone";

type Counts = UtilisationSite["totals"];

function defaultRange() {
  const end = melbourneDateStr();
  return { start: format(subMonths(parseISO(end), 6), "yyyy-MM-dd"), end };
}

export function validateRange(start: string, end: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !isValid(parseISO(start))) return "Enter a valid start date.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !isValid(parseISO(end))) return "Enter a valid end date.";
  if (start > end) return "Start date must be on or before the end date.";
  return null;
}

const fmtDate = (s: string) => format(parseISO(s), "d MMM yyyy");
const nf = (n: number) => n.toLocaleString("en-AU");

type Series = { key: keyof Counts; label: string; color: string };
const COLUMNS: { id: string; title: string; series: Series[] }[] = [
  { id: "bsc", title: "Before School Care", series: [{ key: "bsc", label: "Before School Care", color: "#2f6f8f" }] },
  {
    id: "asc",
    title: "After School Care",
    series: [
      { key: "asc", label: "After School Care", color: "#3b8c6e" },
      { key: "pupilFree", label: "Pupil-free care", color: "#d9893b" },
    ],
  },
  { id: "vac", title: "Vacation Care", series: [{ key: "vac", label: "Vacation Care", color: "#8a5a9e" }] },
];

const TABLE_COLUMNS: Series[] = COLUMNS.flatMap((col) => col.series).map((s) => (
  s.key === "pupilFree" ? { ...s, label: "Pupil-free days" } : s
));
const bookingTotal = (counts: Counts) => TABLE_COLUMNS.reduce((sum, s) => sum + counts[s.key], 0);

function Cell({ site, s }: { site: UtilisationSite; s: Series }) {
  const recorded = site.recordedSessions[s.key] > 0;
  return recorded || site.totals[s.key] > 0 ? (
    <span>{nf(site.totals[s.key])}</span>
  ) : (
    <span className="text-muted-foreground italic" title="No saved numeric records">
      <span aria-hidden="true">—</span>
      <span className="sr-only">No records</span>
    </span>
  );
}

function UtilColumn({ col, sites, totals }: { col: (typeof COLUMNS)[number]; sites: UtilisationSite[]; totals: Counts }) {
  const total = col.series.reduce((a, s) => a + totals[s.key], 0);
  const data = sites.map((s) => ({
    name: s.siteName + (s.status !== "active" ? ` (${s.status})` : ""),
    ...Object.fromEntries(col.series.map((x) => [x.key, s.totals[x.key]])),
  }));
  const multi = col.series.length > 1;
  return (
    <section aria-labelledby={`util-${col.id}`} className="min-w-0 space-y-3" data-testid={`utilisation-column-${col.id}`}>
      <div>
        <h3 id={`util-${col.id}`} className="font-semibold">{col.title}</h3>
        <p className="text-2xl font-bold tabular-nums" data-testid={`text-utilisation-total-${col.id}`}>
          {nf(total)} <span className="text-xs font-normal text-muted-foreground">total bookings{multi ? " (After School + pupil-free)" : ""}</span>
        </p>
        {multi && (
          <p className="text-xs text-muted-foreground">
            After School Care {nf(totals.asc)} · Pupil-free care {nf(totals.pupilFree)}
          </p>
        )}
      </div>
      <div role="img" aria-label={`Horizontal bar chart of ${col.title} bookings by site. Exact figures in the table below.`}>
        <ResponsiveContainer width="100%" height={Math.max(160, sites.length * 30 + 60)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} interval={0} tickFormatter={(name: string) => name.length > 17 ? `${name.slice(0, 16)}…` : name} />
            <Tooltip formatter={(v: number, n: string) => [nf(v), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {col.series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function UtilisationTable({ sites, totals }: { sites: UtilisationSite[]; totals: Counts }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Utilisation booking totals">
      <table className="w-full min-w-[640px] text-sm" data-testid="table-utilisation">
        <caption className="sr-only">Booking totals by site and session for the selected date range</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="text-left px-3 py-2 font-medium text-muted-foreground">Site</th>
            {TABLE_COLUMNS.map((s) => (
              <th key={s.key} scope="col" className="text-right px-3 py-2 font-medium text-muted-foreground">{s.label}</th>
            ))}
            <th scope="col" className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.siteId} className="border-b last:border-0" data-testid={`row-utilisation-${site.siteId}`}>
              <th scope="row" className="text-left px-3 py-2 font-normal">
                {site.siteName}
                {site.identifier ? <span className="text-muted-foreground"> ({site.identifier})</span> : null}
                {site.status !== "active" && <span className="ml-1 text-muted-foreground capitalize">· {site.status}</span>}
              </th>
              {TABLE_COLUMNS.map((s) => (
                <td key={s.key} className="px-3 py-2 text-right tabular-nums"><Cell site={site} s={s} /></td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                {TABLE_COLUMNS.some((s) => site.recordedSessions[s.key] > 0 || site.totals[s.key] > 0)
                  ? nf(bookingTotal(site.totals))
                  : <span className="text-muted-foreground" title="No saved numeric records"><span aria-hidden="true">—</span><span className="sr-only">No records</span></span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold">
            <th scope="row" className="text-left px-3 py-2">Overall total</th>
            {TABLE_COLUMNS.map((s) => (
              <td key={s.key} className="px-3 py-2 text-right tabular-nums">{nf(totals[s.key])}</td>
            ))}
            <td className="px-3 py-2 text-right tabular-nums">{nf(bookingTotal(totals))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function UtilisationSection() {
  const initial = useMemo(defaultRange, []);
  const [startInput, setStartInput] = useState(initial.start);
  const [endInput, setEndInput] = useState(initial.end);
  const [applied, setApplied] = useState(initial);
  const [touched, setTouched] = useState(false);

  const inputError = validateRange(startInput, endInput);
  const appliedValid = validateRange(applied.start, applied.end) === null;

  const q = useGetDashboardUtilisation(
    { startDate: applied.start, endDate: applied.end },
    {
      query: {
        queryKey: ["/api/dashboard/utilisation", { startDate: applied.start, endDate: applied.end }],
        enabled: appliedValid,
        staleTime: 30_000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchInterval: 60_000,
      },
    },
  );

  const data = q.data && q.data.startDate === applied.start && q.data.endDate === applied.end ? q.data : undefined;
  const sites = data?.sites ?? [];

  function apply() {
    setTouched(true);
    if (inputError) return;
    if (startInput === applied.start && endInput === applied.end) {
      void q.refetch();
    } else {
      setApplied({ start: startInput, end: endInput });
    }
  }

  return (
    <Card data-testid="card-utilisation">
      <CardHeader>
        <CardTitle className="text-lg">Utilisation Data</CardTitle>
        <p className="text-xs text-muted-foreground">
          Bookings across all sites, from attendance saved in school accounts’ Reports tab. Counts are session bookings, not unique children or capacity percentages. Pupil-free care is shown separately from After School Care. A dash means no saved records.
        </p>
        <form
          className="flex flex-wrap items-end gap-3 pt-2"
          onSubmit={(e) => { e.preventDefault(); apply(); }}
        >
          <div className="space-y-1">
            <label htmlFor="util-start" className="text-xs font-medium">Start date</label>
            <Input id="util-start" type="date" value={startInput} max={endInput || undefined} onChange={(e) => setStartInput(e.target.value)} aria-invalid={touched && !!inputError} aria-describedby={touched && inputError ? "util-range-error" : undefined} data-testid="input-utilisation-start" />
          </div>
          <div className="space-y-1">
            <label htmlFor="util-end" className="text-xs font-medium">End date (inclusive)</label>
            <Input id="util-end" type="date" value={endInput} min={startInput || undefined} onChange={(e) => setEndInput(e.target.value)} aria-invalid={touched && !!inputError} data-testid="input-utilisation-end" />
          </div>
          <Button type="submit" disabled={q.isFetching && appliedValid && !data} data-testid="button-utilisation-apply">Apply</Button>
          {touched && inputError && (
            <p id="util-range-error" role="alert" className="text-sm text-destructive" data-testid="text-utilisation-range-error">{inputError}</p>
          )}
        </form>
        <p className="text-xs text-muted-foreground" data-testid="text-utilisation-range">
          Showing {fmtDate(applied.start)} to {fmtDate(applied.end)}
        </p>
      </CardHeader>
      <CardContent>
        {q.isError && data && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-destructive">
            <p>The latest attendance update could not be loaded. Showing the last retrieved totals for this date range.</p>
            <Button variant="outline" size="sm" onClick={() => q.refetch()}>Retry</Button>
          </div>
        )}
        {q.isError && !data ? (
          <div role="alert" className="py-8 text-center space-y-3" data-testid="state-utilisation-error">
            <p className="text-sm text-destructive">Utilisation data for {fmtDate(applied.start)} to {fmtDate(applied.end)} could not be loaded.</p>
            <Button variant="outline" onClick={() => q.refetch()} data-testid="button-utilisation-retry">Retry</Button>
          </div>
        ) : !data ? (
          <div className="grid gap-6 lg:grid-cols-3" aria-busy="true" data-testid="state-utilisation-loading">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="state-utilisation-empty">No sites returned for this date range.</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
              {COLUMNS.map((c) => <UtilColumn key={c.id} col={c} sites={sites} totals={data.totals} />)}
            </div>
            <UtilisationTable sites={sites} totals={data.totals} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
