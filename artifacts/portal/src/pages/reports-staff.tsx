import { useGetStaffComplianceReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserCheck, CheckCircle2, XCircle, ShieldX, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";

const COMPLIANCE_CONFIG: Record<string, { label: string; className: string }> = {
  cannot_work:       { label: "Cannot Work",       className: "bg-red-100 text-red-800 border-red-200" },
  responsible_person:{ label: "Responsible Person", className: "bg-green-100 text-green-800 border-green-200" },
  educator:          { label: "Educator",           className: "bg-blue-100 text-blue-800 border-blue-200" },
  incomplete:        { label: "Incomplete",         className: "bg-amber-100 text-amber-800 border-amber-200" },
};

export default function ReportsStaff() {
  const { data: report, isLoading } = useGetStaffComplianceReport();
  const [, navigate] = useLocation();

  const ROLE_LABELS: Record<string, string> = {
    director: "Director",
    educator: "Educator",
    assistant: "Assistant",
    trainee: "Trainee",
    admin: "Admin",
    coordinator: "Coordinator",
    educational_leader: "Educational Leader",
    room_leader: "Room Leader",
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold tracking-tight">Staff Compliance</h1></div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const staffList = report?.staff ?? [];
  const expiringQuals = report?.expiringQualifications ?? [];
  const cannotWorkCount = staffList.filter((s) => s.complianceStatus === "cannot_work").length;
  const fullyCompliantCount = staffList.filter((s) => s.complianceStatus === "responsible_person" || s.complianceStatus === "educator").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Compliance</h1>
        <p className="text-muted-foreground mt-1">Qualification compliance status for all active staff based on recorded certifications.</p>
      </div>

      {expiringQuals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <Clock className="h-4 w-4 text-amber-600" />
              Qualifications Expiring Within 14 Days
              <Badge className="ml-1 bg-amber-200 text-amber-900 border-amber-300">{expiringQuals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-amber-200 bg-amber-100/60">
                    <th className="text-left px-6 py-2.5 font-medium text-amber-900">Staff Member</th>
                    <th className="text-left px-4 py-2.5 font-medium text-amber-900">Qualification</th>
                    <th className="text-left px-4 py-2.5 font-medium text-amber-900">Expiry Date</th>
                    <th className="text-right px-6 py-2.5 font-medium text-amber-900">Days Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {expiringQuals.map((q) => (
                    <tr
                      key={q.qualId}
                      className="hover:bg-amber-100/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/staff/${q.staffId}`)}
                    >
                      <td className="px-6 py-3 font-medium text-primary hover:underline">{q.staffName}</td>
                      <td className="px-4 py-3 text-foreground">{q.qualName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{format(parseISO(q.expiryDate), "dd/MM/yyyy")}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          q.daysUntilExpiry <= 3
                            ? "bg-red-100 text-red-800"
                            : q.daysUntilExpiry <= 7
                            ? "bg-orange-100 text-orange-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {q.daysUntilExpiry === 0 ? "Today" : q.daysUntilExpiry === 1 ? "1 day" : `${q.daysUntilExpiry} days`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Educator or Above</p>
              <p className="text-3xl font-bold text-green-600">{fullyCompliantCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <ShieldX className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Cannot Work</p>
              <p className="text-3xl font-bold text-red-600">{cannotWorkCount}</p>
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
                    const config = COMPLIANCE_CONFIG[s.complianceStatus] ?? COMPLIANCE_CONFIG.incomplete;
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
                          <span className={s.pdHoursThisYear > 0 ? "font-medium" : "text-muted-foreground"}>
                            {s.pdHoursThisYear}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`border ${config.className}`} variant="outline">{config.label}</Badge>
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

      <div className="text-xs text-muted-foreground space-y-1">
        <p><span className="font-medium text-foreground">Cannot Work</span> — WWCC, CPR Renewal, or First Aid is expired.</p>
        <p><span className="font-medium text-foreground">Responsible Person</span> — All required qualifications current (WWCC, First Aid, CPR, Food Safety, Responsible Person Declaration, Staff Details, Education Qualifications, Child Safety — Mandatory Reporting, History &amp; Compliance).</p>
        <p><span className="font-medium text-foreground">Educator</span> — Core three current: WWCC, Staff Details (DET), and Child Safety — Mandatory Reporting.</p>
        <p><span className="font-medium text-foreground">Incomplete</span> — One or more core qualifications missing or not yet recorded.</p>
      </div>
    </div>
  );
}
