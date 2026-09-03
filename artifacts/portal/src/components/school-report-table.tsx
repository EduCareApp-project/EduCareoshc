import { format, parseISO } from "date-fns";
import type { SchoolReportTerm } from "@/hooks/use-schools";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SchoolReportTable({ term }: { term: SchoolReportTerm }) {
  if (!term.generatedAt || term.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        This report has not been generated yet.
      </div>
    );
  }

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
          {term.rows.map((row) => (
            <TableRow key={row.id} className={row.serviceType === "ASC" ? "border-b-2" : "border-b-0"}>
              {row.serviceType === "BSC" && (
                <TableCell rowSpan={2} className="border-r pl-4 align-middle font-medium">
                  <span className="block text-xs text-muted-foreground">Week {row.weekNumber}</span>
                  {format(parseISO(row.weekBeginning), "d MMM yyyy")}
                </TableCell>
              )}
              <TableCell className="font-semibold text-primary">{row.serviceType}</TableCell>
              <TableCell>{row.monday || "—"}</TableCell>
              <TableCell>{row.tuesday || "—"}</TableCell>
              <TableCell>{row.wednesday || "—"}</TableCell>
              <TableCell>{row.thursday || "—"}</TableCell>
              <TableCell className="pr-4">{row.friday || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}