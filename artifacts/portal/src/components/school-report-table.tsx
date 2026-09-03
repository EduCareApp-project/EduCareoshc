import { format, parseISO } from "date-fns";
import { Loader2, Save } from "lucide-react";
import type { SchoolReportRow, SchoolReportTerm } from "@/hooks/use-schools";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const ATTENDANCE_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type AttendanceDay = (typeof ATTENDANCE_DAYS)[number];
export type AttendanceValues = Record<number, Record<AttendanceDay, string>>;

const DAY_LABELS: Record<AttendanceDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

function AttendanceTable({
  rows,
  editable = false,
  values,
  onChange,
}: {
  rows: SchoolReportRow[];
  editable?: boolean;
  values?: AttendanceValues;
  onChange?: (rowId: number, day: AttendanceDay, value: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="min-w-36 pl-4">Week beginning</TableHead>
            <TableHead className="w-20">Session</TableHead>
            <TableHead className="min-w-28">Monday</TableHead>
            <TableHead className="min-w-28">Tuesday</TableHead>
            <TableHead className="min-w-28">Wednesday</TableHead>
            <TableHead className="min-w-28">Thursday</TableHead>
            <TableHead className="min-w-28 pr-4">Friday</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const showWeekCell = row.serviceType === "BSC" || row.serviceType === "VAC";
            return (
            <TableRow key={row.id} className={row.serviceType === "ASC" || row.serviceType === "VAC" ? "border-b-2" : "border-b-0"}>
              {showWeekCell && (
                <TableCell rowSpan={row.serviceType === "BSC" ? 2 : 1} className="border-r pl-4 align-middle font-medium">
                  <span className="block text-xs text-muted-foreground">Week {row.weekNumber}</span>
                  {format(parseISO(row.weekBeginning), "d MMM yyyy")}
                </TableCell>
              )}
              <TableCell className="font-semibold text-primary">{row.serviceType}</TableCell>
              {ATTENDANCE_DAYS.map((day) => (
                <TableCell key={day} className={day === "friday" ? "pr-4" : undefined}>
                  {editable ? (
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className="h-9 min-w-20"
                      aria-label={`${row.serviceType} week ${row.weekNumber} ${DAY_LABELS[day]} attendance`}
                      value={values?.[row.id]?.[day] ?? ""}
                      onChange={(event) => onChange?.(row.id, day, event.target.value)}
                    />
                  ) : (
                    row[day] || "—"
                  )}
                </TableCell>
              ))}
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function SchoolReportTable({ term }: { term: SchoolReportTerm }) {
  if (!term.generatedAt || term.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        This report has not been generated yet.
      </div>
    );
  }

  const termRows = term.rows.filter((row) => row.serviceType !== "VAC");
  const holidayRows = term.rows.filter((row) => row.serviceType === "VAC");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Term attendance</h4>
        <AttendanceTable rows={termRows} />
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Holiday attendance</h4>
        {holidayRows.length > 0 ? (
          <AttendanceTable rows={holidayRows} />
        ) : (
          <div className="rounded-lg border border-dashed px-5 py-6 text-sm text-muted-foreground">
            No VAC rows were generated because holiday program dates have not been set.
          </div>
        )}
      </div>
    </div>
  );
}

export function SchoolReportAttendanceForm({
  term,
  values,
  onChange,
  onSave,
  isSaving,
}: {
  term: SchoolReportTerm;
  values: AttendanceValues;
  onChange: (rowId: number, day: AttendanceDay, value: string) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const termRows = term.rows.filter((row) => row.serviceType !== "VAC");
  const holidayRows = term.rows.filter((row) => row.serviceType === "VAC");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Term attendance</h4>
        <AttendanceTable rows={termRows} editable values={values} onChange={onChange} />
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Holiday attendance</h4>
        {holidayRows.length > 0 ? (
          <AttendanceTable rows={holidayRows} editable values={values} onChange={onChange} />
        ) : (
          <div className="rounded-lg border border-dashed px-5 py-6 text-sm text-muted-foreground">
            Set holiday program dates and regenerate this report to create VAC attendance rows.
          </div>
        )}
      </div>
      <div className="flex justify-end border-t pt-4">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save attendance
        </Button>
      </div>
    </div>
  );
}