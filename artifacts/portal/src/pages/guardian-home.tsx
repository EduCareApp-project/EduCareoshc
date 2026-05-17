import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth";
import { useListSites } from "@workspace/api-client-react";
import { Baby, Calendar, User, ExternalLink, ShieldCheck, FileText } from "lucide-react";

type Child = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  ageGroup: string | null;
  status: string;
  enrollmentDate: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  siteId: number | null;
};

function ageFromDob(dob: string | null): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  if (totalMonths < 12) return `${totalMonths} months`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `${y}y ${m}m` : `${y} year${y !== 1 ? "s" : ""}`;
}

const AGE_GROUP_LABELS: Record<string, string> = {
  infant: "Infant",
  toddler: "Toddler",
  preschool: "Preschool",
  school_age: "School Age",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  enrolled: "bg-blue-100 text-blue-800",
  waitlisted: "bg-amber-100 text-amber-800",
  inactive: "bg-gray-100 text-gray-600",
};

export default function GuardianHome() {
  const { user } = useAuth();

  const { data: children, isLoading } = useQuery<Child[]>({
    queryKey: ["/api/auth/my-children"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-children");
      if (!res.ok) throw new Error("Failed to load children");
      return res.json();
    },
  });

  const { data: sites } = useListSites();

  // Derive unique site IDs from this guardian's children
  const childSiteIds = [...new Set((children ?? []).map((c) => c.siteId).filter((id): id is number => id != null))];

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* Top-right buttons */}
      <div className="flex justify-end gap-2 flex-wrap">
        {childSiteIds.map((siteId) => {
          const site = (sites ?? []).find((s) => s.id === siteId);
          const siteName = site?.name ?? "Our Service";
          return (
            <React.Fragment key={siteId}>
              <a
                href={`/service-docs?siteId=${siteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow"
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                Service Documentation
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
              <a
                href={`/qip-public?siteId=${siteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow"
              >
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                {siteName} QIP
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            </React.Fragment>
          );
        })}
      </div>

      {/* Welcome */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] p-6 text-white">
        <p className="text-sm text-white/70 mb-1">Welcome back</p>
        <h1 className="text-2xl font-bold mb-0.5">{user?.name ?? "Guardian"}</h1>
        <p className="text-white/70 text-sm">
          {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Children section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Baby className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">
            {(children?.length ?? 0) === 1 ? "Your Child" : "Your Children"}
          </h2>
          {!isLoading && (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">
              {children?.length ?? 0}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : !children || children.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Baby className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No children linked to your account yet.</p>
              <p className="text-xs mt-1">Please contact the centre if this is unexpected.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1.5" style={{ background: "linear-gradient(90deg, #4CAF50, #2196F3)" }} />
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {child.firstName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base leading-tight">
                          {child.firstName} {child.lastName}
                        </h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[child.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {child.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 shrink-0" />
                          <span>{ageFromDob(child.dateOfBirth)}</span>
                          {child.ageGroup && (
                            <span className="text-muted-foreground/60">· {AGE_GROUP_LABELS[child.ageGroup] ?? child.ageGroup}</span>
                          )}
                        </div>
                        {child.enrollmentDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>
                              Enrolled{" "}
                              {new Date(child.enrollmentDate).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground">
            Questions about your child's program? Contact the centre directly or check the{" "}
            <a href="/notices" className="text-primary underline underline-offset-2">Notices & News</a>{" "}
            for updates from your educators.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
