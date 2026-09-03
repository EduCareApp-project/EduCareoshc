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
import { Checkbox } from "@/components/ui/checkbox";

export const ATTENDANCE_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type AttendanceDay = (typeof ATTENDANCE_DAYS)[number];
export type AttendanceValues = Record<number, Record<AttendanceDay, string>>;
export type PupilFreeDays = Record<number, Record<AttendanceDay, boolean>>;

const DAY_LABELS: Record<AttendanceDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

const PUPIL_FREE_FIELDS: Record<AttendanceDay, keyof SchoolReportRow> = {
  monday: "mondayPupilFree",
  tuesday: "tuesdayPupilFree",
  wednesday: "wednesdayPupilFree",
  thursday: "thursdayPupilFree",
  friday: "fridayPupilFree",
};

function AttendanceTable({
  rows,
  editable = false,
  values,
  pupilFreeDays,
  onChange,
  onPupilFreeDayChange,
}: {
  rows: SchoolReportRow[];
  editable?: boolean;
  values?: AttendanceValues;
  pupilFreeDays?: PupilFreeDays;
  onChange?: (rowId: number, day: AttendanceDay, value: string) => void;
  onPupilFreeDayChange?: (rowId: number, day: AttendanceDay, checked: boolean) => void;
}) {
  const isPupilFreeDay = (row: SchoolReportRow, day: AttendanceDay) =>
    pupilFreeDays?.[row.id]?.[day] ?? row[PUPIL_FREE_FIELDS[day]] === true;
  const rowsByWeek = new Map<number, Partial<Record<SchoolReportRow["serviceType"], SchoolReportRow>>>();
  for (const row of rows) {
    const weekRows = rowsByWeek.get(row.weekNumber) ?? {};
    weekRows[row.serviceType] = row;
    rowsByWeek.set(row.weekNumber, weekRows);
  }
  const closedDays = Array.from(rowsByWeek.entries()).flatMap(([weekNumber, weekRows]) =>
    ATTENDANCE_DAYS
      .filter((day) => {
        const before = weekRows.BSC;
        const after = weekRows.ASC;
        return before && after && isPupilFreeDay(before, day) && isPupilFreeDay(after, day);
      })
      .map((day) => `Week ${weekNumber}, ${DAY_LABELS[day]}`),
  );
  const isServiceClosed = (row: SchoolReportRow, day: AttendanceDay) => {
    const weekRows = rowsByWeek.get(row.weekNumber);
    return Boolean(
      weekRows?.BSC &&
      weekRows.ASC &&
      isPupilFreeDay(weekRows.BSC, day) &&
      isPupilFreeDay(weekRows.ASC, day),
    );
  };

  return (
    <div className="space-y-2">
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
              const canMarkPupilFree = row.serviceType === "BSC" || row.serviceType === "ASC";
              return (
              <TableRow key={row.id} className={row.serviceType === "ASC" || row.serviceType === "VAC" ? "border-b-2" : "border-b-0"}>
                {showWeekCell && (
                  <TableCell rowSpan={row.serviceType === "BSC" ? 2 : 1} className="border-r pl-4 align-middle font-medium">
                    <span className="block text-xs text-muted-foreground">Week {row.weekNumber}</span>
                    {format(parseISO(row.weekBeginning), "d MMM yyyy")}
                  </TableCell>
                )}
                <TableCell className="font-semibold text-primary">{row.serviceType}</TableCell>
                {ATTENDANCE_DAYS.map((day) => {
                  const isPupilFree = isPupilFreeDay(row, day);
                  return (
                    <TableCell key={day} className={day === "friday" ? "pr-4" : undefined}>
                      {editable ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            disabled={isPupilFree}
                            className={`h-9 min-w-20 ${isPupilFree ? "bg-muted text-muted-foreground opacity-60" : ""}`}
                            aria-label={`${row.serviceType} week ${row.weekNumber} ${DAY_LABELS[day]} attendance`}
                            value={values?.[row.id]?.[day] ?? ""}
                            onChange={(event) => onChange?.(row.id, day, event.target.value)}
                          />
                          {canMarkPupilFree && (
                            <Checkbox
                              className="h-3.5 w-3.5 rounded-[3px]"
                              aria-label={`${row.serviceType} week ${row.weekNumber} ${DAY_LABELS[day]} pupil free day`}
                              title="Pupil free day"
                              checked={isPupilFree}
                              onCheckedChange={(checked) => onPupilFreeDayChange?.(row.id, day, checked === true)}
                            />
                          )}
                        </div>
                      ) : (
                        isPupilFree ? (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {isServiceClosed(row, day) ? "Service Closed" : "Pupil Free"}
                          </span>
                        ) : row[day] ?? "—"
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {closedDays.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Service closed:</span> {closedDays.join(" · ")}
        </p>
      )}
      {editable && (
        <p className="text-xs text-muted-foreground">
          Tick a box to mark that session as a pupil free day. When both BSC and ASC are ticked, the service is recorded as closed for that day.
        </p>
      )}
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
  pupilFreeDays,
  onChange,
  onPupilFreeDayChange,
  onSave,
  isSaving,
}: {
  term: SchoolReportTerm;
  values: AttendanceValues;
  pupilFreeDays: PupilFreeDays;
  onChange: (rowId: number, day: AttendanceDay, value: string) => void;
  onPupilFreeDayChange: (rowId: number, day: AttendanceDay, checked: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const termRows = term.rows.filter((row) => row.serviceType !== "VAC");
  const holidayRows = term.rows.filter((row) => row.serviceType === "VAC");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Term attendance</h4>
        <AttendanceTable
          rows={termRows}
          editable
          values={values}
          pupilFreeDays={pupilFreeDays}
          onChange={onChange}
          onPupilFreeDayChange={onPupilFreeDayChange}
        />
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