import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Loader2,
  Settings2,
} from "lucide-react";
import {
  type SchoolReportTerm,
  useCreateSchoolReportSummary,
  useGenerateSchoolReport,
  useGetSchoolCompletedReports,
  useGetSchoolLiveReportStatistics,
  useGetSchoolReportSummaries,
  useGetSchoolReports,
  useSaveSchoolReportAttendance,
  useSaveSchoolReportTerm,
} from "@/hooks/use-schools";
import { SchoolSummaryReport } from "@/components/school-summary-report";
import {
  ATTENDANCE_DAYS,
  type AttendanceDay,
  type AttendanceValues,
  type PupilFreeDays,
  SchoolReportAttendanceForm,
  SchoolReportTable,
} from "@/components/school-report-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type TermForm = {
  termStartDate: string;
  termEndDate: string;
  holidayStartDate: string;
  holidayEndDate: string;
  holidayProgramApplies: boolean;
};

type ReportFrequency = "term" | "half-year" | "annual";

const EMPTY_FORM: TermForm = {
  termStartDate: "",
  termEndDate: "",
  holidayStartDate: "",
  holidayEndDate: "",
  holidayProgramApplies: true,
};

function calculateWeeks(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const day = start.getDay();
  const firstMonday = new Date(start);
  firstMonday.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return Math.floor((end.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function dateRangeLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "Dates not set";
  return `${format(parseISO(start), "d MMM")} – ${format(parseISO(end), "d MMM yyyy")}`;
}

export function SchoolReportsPanel({ siteId, isAdmin = false }: { siteId: number; isAdmin?: boolean }) {
  const { toast } = useToast();
  const [reportYear, setReportYear] = useState(() => new Date().getFullYear());
  const { data, isLoading, isError } = useGetSchoolReports(siteId, reportYear);
  const saveTerm = useSaveSchoolReportTerm(siteId);
  const generateReport = useGenerateSchoolReport(siteId);
  const saveAttendance = useSaveSchoolReportAttendance(siteId);
  const { data: generatedReports = [], isLoading: reportsLoading } = useGetSchoolReportSummaries(siteId, reportYear);
  const createSummaryReport = useCreateSchoolReportSummary(siteId);
  const [selectedTermNumber, setSelectedTermNumber] = useState(1);
  const [contributingTermNumber, setContributingTermNumber] = useState<number | null>(null);
  const [editingTerm, setEditingTerm] = useState<SchoolReportTerm | null>(null);
  const [form, setForm] = useState<TermForm>(EMPTY_FORM);
  const [attendanceValues, setAttendanceValues] = useState<AttendanceValues>({});
  const [pupilFreeDays, setPupilFreeDays] = useState<PupilFreeDays>({});
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportFrequency, setReportFrequency] = useState<ReportFrequency>("term");
  const [reportPeriod, setReportPeriod] = useState("1");
  const [selectedSummaryReportId, setSelectedSummaryReportId] = useState<number | null>(null);
  const selectedTerm = data?.terms.find((term) => term.termNumber === selectedTermNumber) ?? null;
  const calculatedWeeks = calculateWeeks(form.termStartDate, form.termEndDate);
  const selectedSummaryReport = generatedReports.find((report) => report.id === selectedSummaryReportId) ?? null;

  const openDateDialog = (term: SchoolReportTerm) => {
    setEditingTerm(term);
    setForm({
      termStartDate: term.termStartDate ?? "",
      termEndDate: term.termEndDate ?? "",
      holidayStartDate: term.holidayStartDate ?? "",
      holidayEndDate: term.holidayEndDate ?? "",
      holidayProgramApplies: term.holidayProgramApplies,
    });
  };

  useEffect(() => {
    if (data?.terms.length && !data.terms.some((term) => term.termNumber === selectedTermNumber)) {
      setSelectedTermNumber(data.terms[0].termNumber);
    }
  }, [data, selectedTermNumber]);

  useEffect(() => {
    if (!selectedTerm || contributingTermNumber !== selectedTerm.termNumber) return;
    setAttendanceValues(Object.fromEntries(selectedTerm.rows.map((row) => [
      row.id,
      Object.fromEntries(ATTENDANCE_DAYS.map((day) => [day, row[day] ?? ""])),
    ])) as AttendanceValues);
    setPupilFreeDays(Object.fromEntries(selectedTerm.rows.map((row) => [
      row.id,
      Object.fromEntries(ATTENDANCE_DAYS.map((day) => [day, row[`${day}PupilFree` as keyof typeof row] === true])),
    ])) as PupilFreeDays);
  }, [contributingTermNumber, selectedTerm]);

  function saveDates() {
    if (!editingTerm) return;
    saveTerm.mutate({
      termNumber: editingTerm.termNumber,
      reportYear,
      termStartDate: form.termStartDate,
      termEndDate: form.termEndDate,
      holidayProgramApplies: form.holidayProgramApplies,
      holidayStartDate: form.holidayProgramApplies ? form.holidayStartDate || null : null,
      holidayEndDate: form.holidayProgramApplies ? form.holidayEndDate || null : null,
    }, {
      onSuccess: () => {
        setSelectedTermNumber(editingTerm.termNumber);
        setEditingTerm(null);
        toast({
          title: `Term ${editingTerm.termNumber} dates saved`,
          description: `${calculatedWeeks} weeks calculated.`,
        });
      },
      onError: (error: Error) => toast({
        title: "Unable to save dates",
        description: error.message,
        variant: "destructive",
      }),
    });
  }

  function generate(term: SchoolReportTerm) {
    generateReport.mutate({ termNumber: term.termNumber, reportYear }, {
      onSuccess: () => {
        setSelectedTermNumber(term.termNumber);
        toast({
          title: `Term ${term.termNumber} report generated`,
          description: `${term.weekCount} weeks with BSC and ASC rows are ready.`,
        });
      },
      onError: (error: Error) => toast({
        title: "Unable to generate report",
        description: error.message,
        variant: "destructive",
      }),
    });
  }

  function updateAttendance(rowId: number, day: AttendanceDay, value: string) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setAttendanceValues((current) => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        [day]: value,
      },
    }));
  }

  function updatePupilFreeDay(rowId: number, day: AttendanceDay, checked: boolean) {
    setPupilFreeDays((current) => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        [day]: checked,
      },
    }));
    if (checked) {
      updateAttendance(rowId, day, "");
    }
  }

  function saveAttendanceValues() {
    if (!selectedTerm) return;
    saveAttendance.mutate({
      termNumber: selectedTerm.termNumber,
      reportYear,
      rows: selectedTerm.rows.map((row) => ({
        id: row.id,
        monday: attendanceValues[row.id]?.monday || null,
        tuesday: attendanceValues[row.id]?.tuesday || null,
        wednesday: attendanceValues[row.id]?.wednesday || null,
        thursday: attendanceValues[row.id]?.thursday || null,
        friday: attendanceValues[row.id]?.friday || null,
        mondayPupilFree: pupilFreeDays[row.id]?.monday ?? false,
        tuesdayPupilFree: pupilFreeDays[row.id]?.tuesday ?? false,
        wednesdayPupilFree: pupilFreeDays[row.id]?.wednesday ?? false,
        thursdayPupilFree: pupilFreeDays[row.id]?.thursday ?? false,
        fridayPupilFree: pupilFreeDays[row.id]?.friday ?? false,
      })),
    }, {
      onSuccess: () => {
        setContributingTermNumber(null);
        setAttendanceValues({});
        setPupilFreeDays({});
      },
      onError: (error: Error) => toast({
        title: "Unable to save attendance",
        description: error.message,
        variant: "destructive",
      }),
    });
  }

  function openReportDialog() {
    setReportFrequency("term");
    setReportPeriod("1");
    setReportDialogOpen(true);
  }

  function updateReportFrequency(frequency: string) {
    const nextFrequency = frequency as ReportFrequency;
    setReportFrequency(nextFrequency);
    setReportPeriod(nextFrequency === "annual" ? "annual" : nextFrequency === "half-year" ? "first-half" : "1");
  }

  function generateSummaryReport() {
    createSummaryReport.mutate({
      reportYear,
      frequency: reportFrequency,
      period: reportFrequency === "annual" ? "annual" : reportPeriod,
    }, {
      onSuccess: (report) => {
        setSelectedSummaryReportId(report.id);
        setReportDialogOpen(false);
        toast({
          title: "Report generated",
          description: `${report.periodLabel} is ready.`,
        });
      },
      onError: (error: Error) => toast({
        title: "Unable to generate report",
        description: error.message,
        variant: "destructive",
      }),
    });
  }

  function changeReportYear(direction: -1 | 1) {
    const nextYear = Math.min(2200, Math.max(2000, reportYear + direction));
    if (nextYear === reportYear) return;
    setReportYear(nextYear);
    setSelectedTermNumber(1);
    setContributingTermNumber(null);
    setEditingTerm(null);
    setSelectedSummaryReportId(null);
    setAttendanceValues({});
    setPupilFreeDays({});
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((term) => <Skeleton key={term} className="h-56" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Unable to load school reports.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">School Reports</h3>
          <p className="text-sm text-muted-foreground">Set term dates and prepare the weekly report for this school.</p>
        </div>
        <div className="flex items-center rounded-lg border bg-background p-1 shadow-sm" aria-label="School report year">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Show ${reportYear - 1} school reports`}
            disabled={reportYear <= 2000}
            onClick={() => changeReportYear(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-20 px-3 text-center">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Year</span>
            <span className="block text-sm font-semibold">{reportYear}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Show ${reportYear + 1} school reports`}
            disabled={reportYear >= 2200}
            onClick={() => changeReportYear(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.terms.map((term) => (
          <Card
            key={term.termNumber}
            className={`cursor-pointer transition-all hover:border-primary/60 hover:shadow-sm ${selectedTermNumber === term.termNumber ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => {
              setSelectedTermNumber(term.termNumber);
              if (contributingTermNumber !== term.termNumber) setContributingTermNumber(null);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-lg">Term {term.termNumber}</CardTitle>
                <Badge variant={term.status === "open" ? "default" : "secondary"} className="capitalize">{term.status}</Badge>
              </div>
              <CardDescription>{dateRangeLabel(term.termStartDate, term.termEndDate)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                <span>{term.weekCount ? `${term.weekCount} weeks` : "Weeks calculate after dates are set"}</span>
              </div>
              <div className="min-h-10 text-xs text-muted-foreground">
                {!term.holidayProgramApplies
                  ? "Holiday program does not apply"
                  : term.holidayStartDate && term.holidayEndDate
                    ? `Holiday program: ${dateRangeLabel(term.holidayStartDate, term.holidayEndDate)}`
                    : "Holiday program dates not set"}
              </div>
              <div className="flex gap-2 pt-1">
                {term.status === "pending" ? (
                  <Button size="sm" className="w-full" onClick={(event) => { event.stopPropagation(); openDateDialog(term); }}>
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    Begin
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="flex-1" onClick={(event) => { event.stopPropagation(); openDateDialog(term); }}>
                      <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                      Edit dates
                    </Button>
                    {term.generatedAt ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedTermNumber(term.termNumber);
                          setContributingTermNumber(term.termNumber);
                          requestAnimationFrame(() => {
                            document.getElementById("selected-school-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          });
                        }}
                      >
                        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                        Contribute
                      </Button>
                    ) : (
                      <Button size="sm" className="flex-1" disabled={generateReport.isPending} onClick={(event) => { event.stopPropagation(); generate(term); }}>
                        {generateReport.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />}
                        Generate
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTerm && (
        <Card id="selected-school-report">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Term {selectedTerm.termNumber} Attendance</CardTitle>
                <CardDescription className="mt-1">
                  {selectedTerm.generatedAt
                    ? `Generated ${format(new Date(selectedTerm.generatedAt), "d MMM yyyy 'at' h:mm a")}`
                    : "Confirm the dates above, then generate this report."}
                </CardDescription>
              </div>
              {selectedTerm.generatedAt && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  <Check className="mr-1 h-3.5 w-3.5" />Generated
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {contributingTermNumber === selectedTerm.termNumber ? (
              <SchoolReportAttendanceForm
                term={selectedTerm}
                values={attendanceValues}
                pupilFreeDays={pupilFreeDays}
                onChange={updateAttendance}
                onPupilFreeDayChange={updatePupilFreeDay}
                onSave={saveAttendanceValues}
                isSaving={saveAttendance.isPending}
              />
            ) : (
              <SchoolReportTable term={selectedTerm} />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Reports</CardTitle>
              <CardDescription className="mt-1">
                Generate attendance reports for a term, half year, or the current year.
              </CardDescription>
            </div>
            <Button onClick={openReportDialog}>
              <FileText className="mr-1.5 h-4 w-4" />
              Generate report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : generatedReports.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Generated reports</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {generatedReports.map((report) => report.archivedAt ? (
                  <button
                    type="button"
                    key={report.id}
                    onClick={() => setSelectedSummaryReportId(report.id)}
                    className="flex items-center gap-2 px-1 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span>{report.periodLabel}</span>
                    <span className="text-xs">(Archived)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    key={report.id}
                    onClick={() => setSelectedSummaryReportId(report.id)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                      selectedSummaryReportId === report.id ? "border-primary bg-primary/5" : "bg-muted/30"
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{report.periodLabel}</p>
                      <p className="text-xs capitalize text-muted-foreground">{report.frequency.replace("-", " ")}</p>
                    </div>
                    <Badge variant={report.status === "finalized" ? "default" : "secondary"}>
                      {report.status === "finalized" ? "Finalised" : "Draft"}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-5 py-6 text-sm text-muted-foreground">
              No reports generated yet. Select a reporting period to create one.
            </div>
          )}
          {selectedSummaryReport && (
            <SchoolSummaryReport siteId={siteId} report={selectedSummaryReport} canManageLifecycle={isAdmin} />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingTerm} onOpenChange={(open) => !open && setEditingTerm(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Term {editingTerm?.termNumber} dates</DialogTitle>
            <DialogDescription>Set the term and holiday program periods. The number of report weeks is calculated automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Term period</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={form.termStartDate} onChange={(event) => setForm((current) => ({ ...current, termStartDate: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label>End date</Label><Input type="date" value={form.termEndDate} onChange={(event) => setForm((current) => ({ ...current, termEndDate: event.target.value }))} /></div>
              </div>
              <div className="mt-3 rounded-lg bg-muted/60 px-4 py-3 text-sm">
                Calculated report period: <span className="font-semibold">{calculatedWeeks || "—"}{calculatedWeeks ? ` week${calculatedWeeks === 1 ? "" : "s"}` : ""}</span>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Holiday program period</h3>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={!form.holidayProgramApplies}
                    onCheckedChange={(checked) => setForm((current) => ({
                      ...current,
                      holidayProgramApplies: checked !== true,
                      holidayStartDate: checked === true ? "" : current.holidayStartDate,
                      holidayEndDate: checked === true ? "" : current.holidayEndDate,
                    }))}
                  />
                  Does not apply
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Start date</Label><Input type="date" disabled={!form.holidayProgramApplies} value={form.holidayStartDate} onChange={(event) => setForm((current) => ({ ...current, holidayStartDate: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label>End date</Label><Input type="date" disabled={!form.holidayProgramApplies} value={form.holidayEndDate} onChange={(event) => setForm((current) => ({ ...current, holidayEndDate: event.target.value }))} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTerm(null)}>Cancel</Button>
            <Button onClick={saveDates} disabled={saveTerm.isPending || !calculatedWeeks}>
              {saveTerm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New report</DialogTitle>
            <DialogDescription>
              Choose how much attendance data this report should cover.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="report-frequency">Frequency</Label>
              <Select value={reportFrequency} onValueChange={updateReportFrequency}>
                <SelectTrigger id="report-frequency">
                  <SelectValue placeholder="Select a frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="term">Term</SelectItem>
                  <SelectItem value="half-year">Half Year</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportFrequency === "term" && (
              <div className="space-y-2">
                <Label htmlFor="report-term">Term</Label>
                <Select value={reportPeriod} onValueChange={setReportPeriod}>
                  <SelectTrigger id="report-term">
                    <SelectValue placeholder="Select a term" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((termNumber) => (
                      <SelectItem key={termNumber} value={String(termNumber)}>
                        Term {termNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportFrequency === "half-year" && (
              <div className="space-y-2">
                <Label htmlFor="report-half-year">Half year</Label>
                <Select value={reportPeriod} onValueChange={setReportPeriod}>
                  <SelectTrigger id="report-half-year">
                    <SelectValue placeholder="Select a half year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first-half">First half</SelectItem>
                    <SelectItem value="second-half">Second half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportFrequency === "annual" && (
              <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
                Report period: <span className="font-semibold">Current year ({reportYear})</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
            <Button onClick={generateSummaryReport} disabled={createSummaryReport.isPending}>
              {createSummaryReport.isPending
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <FileText className="mr-1.5 h-4 w-4" />}
              Generate report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SchoolCurrentReportsPanel({
  siteId,
  showCompletedReports = true,
}: {
  siteId: number;
  showCompletedReports?: boolean;
}) {
  const { data: reports = [], isLoading } = useGetSchoolCompletedReports(siteId, showCompletedReports);
  const { data: liveStats, isLoading: liveStatsLoading } = useGetSchoolLiveReportStatistics(siteId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Live Service Statistics</h3>
        <p className="text-sm text-muted-foreground">
          Rolling six-month attendance averages for your school.
        </p>
      </div>

      {liveStatsLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      ) : liveStats ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Average Usage by Day</CardTitle>
            </CardHeader>
            <CardContent>
              {liveStats.weeklyAverages.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <BarChart data={liveStats.weekdayAverages}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#71717a" }} stroke="#71717a" />
                      <YAxis tick={{ fontSize: 12, fill: "#71717a" }} stroke="#71717a" allowDecimals={false} />
                      <Tooltip
                        isAnimationActive={false}
                        cursor={{ fill: "rgba(0,0,0,0.05)", stroke: "none" }}
                        contentStyle={{
                          backgroundColor: "#fff",
                          borderRadius: "6px",
                          border: "1px solid #e0e0e0",
                          color: "#1a1a1a",
                          fontSize: "13px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "13px" }} />
                      <Bar dataKey="bsc" name="Before School" fill="#0079F2" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="asc" name="After School" fill="#795EFF" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                      {liveStats.hasVacationCare && (
                        <Bar dataKey="vac" name="Vacation Care" fill="#009118" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  No daily attendance data available for the last six months.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Average Daily Usage by Week</CardTitle>
            </CardHeader>
            <CardContent>
              {liveStats.weeklyAverages.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <LineChart data={liveStats.weeklyAverages}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                      <XAxis
                        dataKey="weekBeginning"
                        tick={{ fontSize: 12, fill: "#71717a" }}
                        stroke="#71717a"
                        interval="preserveStartEnd"
                        minTickGap={28}
                        tickFormatter={(date) => date.split("-").slice(1).join("/")}
                      />
                      <YAxis tick={{ fontSize: 12, fill: "#71717a" }} stroke="#71717a" allowDecimals={false} />
                      <Tooltip
                        isAnimationActive={false}
                        cursor={{ stroke: "#71717a", strokeDasharray: "3 3" }}
                        contentStyle={{
                          backgroundColor: "#fff",
                          borderRadius: "6px",
                          border: "1px solid #e0e0e0",
                          color: "#1a1a1a",
                          fontSize: "13px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "13px" }} />
                      <Line type="monotone" dataKey="bsc" name="Before School" stroke="#0079F2" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="asc" name="After School" stroke="#795EFF" strokeWidth={2} dot={false} isAnimationActive={false} />
                      {liveStats.hasVacationCare && (
                        <Line type="monotone" dataKey="vac" name="Vacation Care" stroke="#009118" strokeWidth={2} dot={false} isAnimationActive={false} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  No weekly attendance data available for the last six months.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Average Attendances</CardTitle>
              <CardDescription>
                Daily averages from {format(parseISO(liveStats.rangeStart), "d MMM yyyy")} to{" "}
                {format(parseISO(liveStats.rangeEnd), "d MMM yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-blue-50/60 p-5">
                <p className="text-sm font-medium text-muted-foreground">Before School Care</p>
                <p className="mt-1 text-3xl font-bold text-blue-700">{liveStats.overallAverages.bsc}</p>
                <p className="mt-1 text-xs text-muted-foreground">average daily attendance</p>
              </div>
              <div className="rounded-xl border bg-violet-50/60 p-5">
                <p className="text-sm font-medium text-muted-foreground">After School Care</p>
                <p className="mt-1 text-3xl font-bold text-violet-700">{liveStats.overallAverages.asc}</p>
                <p className="mt-1 text-xs text-muted-foreground">average daily attendance</p>
              </div>
              {liveStats.hasVacationCare && liveStats.overallAverages.vac !== null && (
                <div className="rounded-xl border bg-green-50/60 p-5">
                  <p className="text-sm font-medium text-muted-foreground">Vacation Care</p>
                  <p className="mt-1 text-3xl font-bold text-green-700">{liveStats.overallAverages.vac}</p>
                  <p className="mt-1 text-xs text-muted-foreground">average daily attendance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex h-72 items-center justify-center p-6 text-sm text-muted-foreground">
            Unable to load live attendance statistics.
          </CardContent>
        </Card>
      )}

      {showCompletedReports && (
        <>
          <div className="border-t pt-8">
            <h3 className="text-lg font-semibold">Completed Reports</h3>
            <p className="text-sm text-muted-foreground">
              Open a completed report in a new tab to view or download its PDF.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Report PDFs</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-24 w-full" /> : reports.length === 0 ? (
                <div className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
                  No completed report PDFs are currently available.
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <a
                      key={report.id}
                      href={`/api/school-reports/${siteId}/summaries/${report.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-4 rounded-xl bg-green-600 px-5 py-4 text-left text-white shadow-sm transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                    >
                      <FileText className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {report.finalizedPdfName || report.periodLabel}
                        </span>
                        {report.finalizedAt && (
                          <span className="mt-0.5 block text-xs text-green-50">
                            Completed {format(parseISO(report.finalizedAt), "d MMMM yyyy")}
                          </span>
                        )}
                      </span>
                      <ExternalLink className="h-5 w-5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}