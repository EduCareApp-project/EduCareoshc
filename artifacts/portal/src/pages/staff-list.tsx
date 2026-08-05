import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListStaff, useGetStaffQualifications, getGetStaffQualificationsQueryKey, useListSites, useGetFeatureSettings, getGetFeatureSettingsQueryKey } from "@workspace/api-client-react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCog, Mail, Phone, Award, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { computeQualLevel, QUAL_LEVEL_LABELS, QUAL_LEVEL_STYLES, type QualItem, type QualLevelConfig } from "@/lib/qual-level";

const ROLE_LABELS: Record<string, string> = { admin: "Admin", educational_leader: "Educational Leader", coordinator: "Coordinator", educator: "Educator" };

export function QualLevelBadge({ staffId, config }: { staffId: number; config?: QualLevelConfig }) {
  const { data: qualifications, isLoading } = useGetStaffQualifications(staffId, {
    query: {
      queryKey: getGetStaffQualificationsQueryKey(staffId),
      refetchInterval: 30 * 1000,
      // The global QueryClient has refetchOnWindowFocus: false, but we
      // explicitly opt in here so that a manager returning to a tab left open
      // overnight gets a fresh fetch immediately on focus rather than waiting
      // up to 30 s for the next polling cycle.
      refetchOnWindowFocus: true,
    },
  });
  if (isLoading) return <span className="text-xs text-muted-foreground">—</span>;
  if (!qualifications?.length) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-800 border-amber-200">
      Incomplete
    </span>
  );
  const level = computeQualLevel(qualifications as QualItem[], config);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${QUAL_LEVEL_STYLES[level]}`}>
      {QUAL_LEVEL_LABELS[level]}
    </span>
  );
}

type TopTab = "active" | "inactive";

export default function StaffList() {
  const { user } = useAuth();
  const { data: staff, isLoading } = useListStaff();
  const { data: sites } = useListSites();
  const siteMap = Object.fromEntries((sites ?? []).map((s) => [s.id, s.name]));
  const [tab, setTab] = useState<TopTab>("active");
  const { data: featureSettings } = useGetFeatureSettings({ query: { queryKey: getGetFeatureSettingsQueryKey() } });
  const qualLevelConfig: QualLevelConfig | undefined = featureSettings ? {
    cannotWorkQuals: featureSettings.staffCannotWorkQuals,
    responsiblePersonQuals: featureSettings.staffResponsiblePersonQuals,
    educatorQuals: featureSettings.staffEducatorQuals,
  } : undefined;

  const { data: accessSettings } = useQuery<Record<string, string[]>>({
    queryKey: ["settings-access"],
    queryFn: async () => {
      const res = await fetch("/api/settings/access");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = user?.role === "admin";
  const disabledHrefs: string[] = isAdmin ? [] : (accessSettings?.[user?.role ?? ""] ?? []);
  const ownProfileOnly = !isAdmin && accessSettings !== undefined && !disabledHrefs.includes("staff_own_profile");

  if (ownProfileOnly && user?.id) {
    return <Redirect to={`/staff/${user.id}`} />;
  }

  const filtered = (staff?.filter((m) => m.status === tab) ?? []).sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );

  const activeCount = staff?.filter((m) => m.status === "active").length ?? 0;
  const inactiveCount = staff?.filter((m) => m.status === "inactive").length ?? 0;

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

      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "active" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Active
          {!isLoading && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${tab === "active" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"}`}>
              {activeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("inactive")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "inactive" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Inactive
          {!isLoading && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${tab === "inactive" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"}`}>
              {inactiveCount}
            </span>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-40 bg-muted/20" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-dashed">
          <UserCog className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-1">No {tab} staff</h3>
          <p className="text-muted-foreground">
            {tab === "active" ? "Add your first staff member to get started." : "No inactive staff members on record."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((member) => (
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
                  {member.siteId && siteMap[member.siteId] && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{siteMap[member.siteId]}</span>
                    </div>
                  )}
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
                    <QualLevelBadge staffId={member.id} config={qualLevelConfig} />
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
