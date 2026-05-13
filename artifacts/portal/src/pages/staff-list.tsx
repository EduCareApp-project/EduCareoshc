import { useListStaff, useGetStaffQualifications } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCog, Mail, Phone, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { computeQualLevel, QUAL_LEVEL_LABELS, QUAL_LEVEL_STYLES, type QualItem } from "@/lib/qual-level";

const ROLE_LABELS: Record<string, string> = { admin: "Admin", educational_leader: "Educational Leader", coordinator: "Coordinator", educator: "Educator" };

function QualLevelBadge({ staffId }: { staffId: number }) {
  const { data: qualifications, isLoading } = useGetStaffQualifications(staffId);
  if (isLoading) return <span className="text-xs text-muted-foreground">—</span>;
  if (!qualifications?.length) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-800 border-amber-200">
      Incomplete
    </span>
  );
  const level = computeQualLevel(qualifications as QualItem[]);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${QUAL_LEVEL_STYLES[level]}`}>
      {QUAL_LEVEL_LABELS[level]}
    </span>
  );
}

export default function StaffList() {
  const { data: staff, isLoading } = useListStaff();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Team</h1>
          <p className="text-muted-foreground mt-1">Manage educators and centre staff.</p>
        </div>
        <Link href="/staff/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Staff Member
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-40 bg-muted/20" />
            </Card>
          ))}
        </div>
      ) : staff?.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-dashed">
          <UserCog className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-1">No staff found</h3>
          <p className="text-muted-foreground">Add your first staff member.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff?.map((member) => (
            <Link key={member.id} href={`/staff/${member.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold">
                      {member.firstName[0]}{member.lastName[0]}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{member.firstName} {member.lastName}</CardTitle>
                      <div className="text-sm text-primary font-medium">{ROLE_LABELS[member.role] ?? member.role}</div>
                    </div>
                  </div>
                  <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                    {member.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="h-4 w-4 shrink-0" />
                    <span className="truncate">{member.qualifications}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  {member.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Qualification Level</span>
                    <QualLevelBadge staffId={member.id} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}