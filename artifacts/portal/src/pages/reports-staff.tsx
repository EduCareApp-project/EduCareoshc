import { useGetStaffComplianceReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserCheck, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function ReportsStaff() {
  const { data: report, isLoading } = useGetStaffComplianceReport();
  const [, navigate] = useLocation();

  const ROLE_LABELS: Record<string, string> = { director: "Director", educator: "Educator", assistant: "Assistant", trainee: "Trainee" };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold tracking-tight">Staff Compliance</h1></div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const staffList = report?.staff ?? [];
  const compliantCount = staffList.filter((s) => s.hasWwcc && s.pdHoursThisYear >= 8).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Compliance</h1>
        <p className="text-muted-foreground mt-1">Working With Children Check status and professional development hours for active staff.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Compliant Staff</p>
              <p className="text-3xl font-bold text-green-600">{compliantCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
              <p className="text-3xl font-bold text-amber-600">{staffList.length - compliantCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <UserCheck className="h-8 w-8 text-primary/60" />
            <div>
              <p className="text-sm text-muted-foreground">Total Active Staff</p>
              <p className="text-3xl font-bold">{staffList.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {staffList.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <UserCheck className="h-8 w-8 mb-2" />
          <p>No active staff found.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Compliance by Staff Member</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">WWCC</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">PD Hours (YTD)</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staffList.map((s) => {
                    const isCompliant = s.hasWwcc && s.pdHoursThisYear >= 8;
                    return (
                      <tr
                        key={s.staffId}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/staff/${s.staffId}`)}
                      >
                        <td className="px-6 py-3 font-medium text-primary hover:underline">{s.staffName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[s.role] || s.role}</td>
                        <td className="px-4 py-3 text-center">
                          {s.hasWwcc
                            ? <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            : <XCircle className="h-4 w-4 text-red-500 mx-auto" />}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={s.pdHoursThisYear >= 8 ? "text-green-700 font-medium" : s.pdHoursThisYear > 0 ? "text-amber-700 font-medium" : "text-muted-foreground"}>
                            {s.pdHoursThisYear}h
                          </span>
                          <span className="text-muted-foreground text-xs ml-1">/ 8h req.</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isCompliant
                            ? <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                            : <Badge className="bg-amber-100 text-amber-800">Incomplete</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">Compliance criteria: Valid WWCC number on file + minimum 8 professional development hours for the current year.</p>
    </div>
  );
}
