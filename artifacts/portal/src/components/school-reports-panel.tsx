import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Check,
  Clock3,
  FileSpreadsheet,
  Loader2,
  Settings2,
} from "lucide-react";
import {
  type SchoolReportTerm,
  useGenerateSchoolReport,
  useGetSchoolReports,
  useSaveSchoolReportAttendance,
  useSaveSchoolReportTerm,
} from "@/hooks/use-schools";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type TermForm = {
  termStartDate: string;
  termEndDate: string;
  holidayStartDate: string;
  holidayEndDate: string;
};

const EMPTY_FORM: TermForm = {
  termStartDate: "",
  termEndDate: "",
  holidayStartDate: "",
  holidayEndDate: "",
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

export function SchoolReportsPanel({ siteId }: { siteId: number }) {
  const { toast } = useToast();
  const { data, isLoading, isError } = useGetSchoolReports(siteId);
  const saveTerm = useSaveSchoolReportTerm(siteId);
  const generateReport = useGenerateSchoolReport(siteId);
  const saveAttendance = useSaveSchoolReportAttendance(siteId);
  const [selectedTermNumber, setSelectedTermNumber] = useState(1);
  const [contributingTermNumber, setContributingTermNumber] = useState<number | null>(null);
  const [editingTerm, setEditingTerm] = useState<SchoolReportTerm | null>(null);
  const [form, setForm] = useState<TermForm>(EMPTY_FORM);
  const [attendanceValues, setAttendanceValues] = useState<AttendanceValues>({});
  const [pupilFreeDays, setPupilFreeDays] = useState<PupilFreeDays>({});
  const selectedTerm = data?.terms.find((term) => term.termNumber === selectedTermNumber) ?? null;
  const calculatedWeeks = calculateWeeks(form.termStartDate, form.termEndDate);

  const openDateDialog = (term: SchoolReportTerm) => {
    setEditingTerm(term);
    setForm({
      termStartDate: term.termStartDate ?? "",
      termEndDate: term.termEndDate ?? "",
      holidayStartDate: term.holidayStartDate ?? "",
      holidayEndDate: term.holidayEndDate ?? "",
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
      termStartDate: form.termStartDate,
      termEndDate: form.termEndDate,
      holidayStartDate: form.holidayStartDate || null,
      holidayEndDate: form.holidayEndDate || null,
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
    generateReport.mutate(term.termNumber, {
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
      onSuccess: () => toast({
        title: "Attendance saved",
        description: `Term ${selectedTerm.termNumber} attendance has been updated.`,
      }),
      onError: (error: Error) => toast({
        title: "Unable to save attendance",
        description: error.message,
        variant: "destructive",
      }),
    });
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
      <div>
        <h3 className="text-lg font-semibold">School Reports</h3>
        <p className="text-sm text-muted-foreground">Set term dates and prepare the weekly report for this school.</p>
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
                {term.holidayStartDate && term.holidayEndDate
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
                <CardTitle>Term {selectedTerm.termNumber} report</CardTitle>
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
              <h3 className="mb-2 text-sm font-semibold">Holiday program period</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={form.holidayStartDate} onChange={(event) => setForm((current) => ({ ...current, holidayStartDate: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label>End date</Label><Input type="date" value={form.holidayEndDate} onChange={(event) => setForm((current) => ({ ...current, holidayEndDate: event.target.value }))} /></div>
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
    </div>
  );
}