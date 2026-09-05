import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Archive, ExternalLink, FileCheck2, Loader2, Save, Trash2 } from "lucide-react";
import {
  type SchoolReportObligations,
  type SchoolReportSummary,
  useFinalizeSchoolReportSummary,
  useArchiveSchoolReportSummary,
  useDeleteSchoolReportSummary,
  useSaveSchoolReportObligations,
} from "@/hooks/use-schools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const OBLIGATION_FIELDS: Array<{
  key: keyof SchoolReportObligations;
  heading: string;
}> = [
  { key: "learningPlayProgramHighlights", heading: "Learning, Play & Program Highlights" },
  { key: "teamServiceLeadership", heading: "Team & Service Leadership" },
  { key: "policyPracticeUpdates", heading: "Policy & Practice Updates" },
  { key: "childSafetyWellbeing", heading: "Child Safety & Wellbeing" },
  { key: "communityFeedbackResolution", heading: "Community Feedback & Resolution" },
  { key: "focusForFuture", heading: "Our Focus for the Future" },
];

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#ef4444"];

export function SchoolSummaryReport({
  siteId,
  report,
  canManageLifecycle = false,
}: {
  siteId: number;
  report: SchoolReportSummary;
  canManageLifecycle?: boolean;
}) {
  const { toast } = useToast();
  const saveObligations = useSaveSchoolReportObligations(siteId);
  const finalizeReport = useFinalizeSchoolReportSummary(siteId);
  const archiveReport = useArchiveSchoolReportSummary(siteId);
  const deleteReport = useDeleteSchoolReportSummary(siteId);
  const [obligations, setObligations] = useState(report.reportingObligations);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"archive" | "delete" | null>(null);
  const locked = report.status === "finalized" || !!report.archivedAt;
  const hasUnsavedChanges = JSON.stringify(obligations) !== JSON.stringify(report.reportingObligations);
  const holidayProgramApplies = report.statistics.holidayProgramApplies !== false;
  const hasHolidayData = report.statistics.holidayWeekdayAverages.some((item) => item.value > 0);

  useEffect(() => {
    setObligations(report.reportingObligations);
  }, [report.id, report.reportingObligations]);

  function save() {
    saveObligations.mutate({
      reportId: report.id,
      reportYear: report.reportYear,
      reportingObligations: obligations,
    }, {
      onSuccess: () => toast({ title: "Reporting obligations saved" }),
      onError: (error: Error) => toast({
        title: "Unable to save reporting obligations",
        description: error.message,
        variant: "destructive",
      }),
    });
  }

  function finalize() {
    finalizeReport.mutate({
      reportId: report.id,
      reportYear: report.reportYear,
    }, {
      onSuccess: () => {
        setConfirmFinalizeOpen(false);
        toast({
          title: "Report finalised",
          description: "The report is locked and ready to download as a PDF.",
        });
      },
      onError: (error: Error) => toast({
        title: "Unable to finalize report",
        description: error.message,
        variant: "destructive",
      }),
    });
  }

  function performLifecycleAction() {
    const mutation = confirmAction === "archive" ? archiveReport : deleteReport;
    mutation.mutate({ reportId: report.id, reportYear: report.reportYear }, {
      onSuccess: () => {
        const action = confirmAction;
        setConfirmAction(null);
        toast({
          title: action === "archive" ? "Report archived" : "Report deleted",
          description: action === "archive"
            ? "A new report can now be generated for this period."
            : "The report has been permanently deleted.",
        });
      },
      onError: (error: Error) => toast({
        title: confirmAction === "archive" ? "Unable to archive report" : "Unable to delete report",
        description: error.message,
        variant: "destructive",
      }),
    });
  }

  return (
    <div className="mt-6 space-y-6 border-t pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{report.periodLabel}</h3>
            <Badge variant={report.archivedAt ? "outline" : locked ? "default" : "secondary"}>
              {report.archivedAt ? "Archived" : locked ? "Finalised" : "Draft"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {report.statistics.dateRange.start} to {report.statistics.dateRange.end}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageLifecycle && (
            <Button variant="destructive" onClick={() => setConfirmAction("delete")}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Statistics</CardTitle>
          <CardDescription>
            Locked attendance snapshot calculated from {report.statistics.termNumbers.map((term) => `Term ${term}`).join(", ")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h4 className="mb-4 text-sm font-semibold">Average Usage by Day</h4>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.statistics.weekdayAverages}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="bsc" name="Before School" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="asc" name="After School" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pupilFree" name="Pupil Free Day" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="mb-4 text-sm font-semibold">Average Daily Usage by Week</h4>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.statistics.weeklyAverages}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="bsc" name="Before School" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="asc" name="After School" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pupilFree" name="Pupil Free Day" stroke="#7c3aed" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {holidayProgramApplies && (
          <div className="rounded-lg border p-4 xl:col-span-2">
            <h4 className="mb-1 text-sm font-semibold">Average Holiday Program Usage by Day</h4>
            <p className="mb-4 text-xs text-muted-foreground">Zero days are excluded as non-operated days, matching the workbook.</p>
            {hasHolidayData ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.statistics.holidayWeekdayAverages}
                      dataKey="value"
                      nameKey="day"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ day, value }) => `${day}: ${value}`}
                    >
                      {report.statistics.holidayWeekdayAverages.map((item, index) => (
                        <Cell key={item.day} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-md bg-muted/40 text-sm text-muted-foreground">
                No holiday-program attendance was recorded for this period.
              </div>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reporting Obligations</CardTitle>
          <CardDescription>
            {report.archivedAt ? "This report is archived and read-only." : locked ? "This report has been finalised and is read-only." : "Complete each section, save your work, then finalise the report."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {OBLIGATION_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`report-obligation-${field.key}`}>{field.heading}</Label>
              <Textarea
                id={`report-obligation-${field.key}`}
                value={obligations[field.key]}
                onChange={(event) => setObligations((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))}
                readOnly={locked}
                className="min-h-28"
                placeholder={locked ? undefined : `Add ${field.heading.toLowerCase()}…`}
              />
            </div>
          ))}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
            {!locked && (
              <>
                <Button variant="outline" onClick={save} disabled={saveObligations.isPending || !hasUnsavedChanges}>
                  {saveObligations.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
                <Button
                  onClick={() => setConfirmFinalizeOpen(true)}
                  disabled={hasUnsavedChanges}
                  title={hasUnsavedChanges ? "Save your changes before finalising" : undefined}
                >
                  <FileCheck2 className="mr-2 h-4 w-4" />
                  Finalise report
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {report.status === "finalized" && (
        <div className="space-y-3">
          <a
            href={`/api/school-reports/${siteId}/summaries/${report.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-green-600 px-6 py-5 text-center font-semibold text-white shadow-sm transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-5 w-5" />
            <span>{report.finalizedPdfName || `${report.periodLabel} PDF`}</span>
          </a>
          {canManageLifecycle && !report.archivedAt && (
            <Button
              variant="outline"
              className="h-auto w-full py-4"
              onClick={() => setConfirmAction("archive")}
            >
              <Archive className="mr-2 h-5 w-5" />
              Archive report and allow a replacement
            </Button>
          )}
        </div>
      )}

      <Dialog open={confirmFinalizeOpen} onOpenChange={setConfirmFinalizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalise this report?</DialogTitle>
            <DialogDescription>
              Finalising locks the Service Statistics and Reporting Obligations. The report can no longer be edited and will be available as a PDF.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFinalizeOpen(false)}>Cancel</Button>
            <Button onClick={finalize} disabled={finalizeReport.isPending}>
              {finalizeReport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalise report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === "archive" ? "Archive this report?" : "Permanently delete this report?"}</DialogTitle>
            <DialogDescription>
              {confirmAction === "archive"
                ? "School users will no longer see this report. Admins can keep it as history and generate a new report for the same period."
                : "This cannot be undone. The report and its saved narrative will be permanently removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction === "delete" ? "destructive" : "default"}
              onClick={performLifecycleAction}
              disabled={archiveReport.isPending || deleteReport.isPending}
            >
              {(archiveReport.isPending || deleteReport.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction === "archive" ? "Archive report" : "Delete report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}