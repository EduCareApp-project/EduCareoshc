import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { useListSites } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Building2, Baby, Mail, Phone } from "lucide-react";
import { Link } from "wouter";

type SuspendedGuardian = {
  guardianEmail: string;
  guardianName: string;
  guardianPhone: string;
  childNames: string[];
};

type SiteGroup = {
  siteId: number;
  siteName: string;
  guardians: SuspendedGuardian[];
};

export default function ReportsFinancial() {
  const { isEducatorRole, ownSiteId } = usePermissions();
  const { data: sites } = useListSites();

  // Educator/coordinator roles are locked to their home site
  const [filterSiteId, setFilterSiteId] = useState<string>(() =>
    isEducatorRole && ownSiteId ? String(ownSiteId) : "__all__"
  );

  const siteIdParam =
    isEducatorRole && ownSiteId
      ? ownSiteId
      : filterSiteId !== "__all__"
        ? parseInt(filterSiteId, 10)
        : null;

  const queryKey = ["suspended-report", siteIdParam];
  const { data, isLoading } = useQuery<SiteGroup[]>({
    queryKey,
    queryFn: async () => {
      const url = siteIdParam
        ? `/api/guardians/financial/suspended-report?siteId=${siteIdParam}`
        : "/api/guardians/financial/suspended-report";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const total = (data ?? []).reduce((n, g) => n + g.guardians.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Accounts — Suspended</h1>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Accounts — Suspended</h1>
          <p className="text-muted-foreground mt-1">
            Guardians with a suspended financial status and their enrolled children.
            {total > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                {total} suspended {total === 1 ? "account" : "accounts"}
              </span>
            )}
          </p>
        </div>

        {/* Site filter — only shown to full-access users */}
        {!isEducatorRole && (
          <Select value={filterSiteId} onValueChange={setFilterSiteId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All sites</SelectItem>
              {(sites ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content */}
      {(data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="h-8 w-8 opacity-30 mb-1" />
            <p className="font-medium">No suspended accounts</p>
            <p className="text-sm">
              {siteIdParam
                ? "No guardians at this site are currently suspended."
                : "No guardians are currently suspended."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {(data ?? []).map((group) => (
            <Card key={group.siteId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {group.siteName}
                  <Badge className="ml-1 bg-red-100 text-red-800 border-red-200">
                    {group.guardians.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t bg-muted/40">
                        <th className="text-left px-6 py-2.5 font-medium text-muted-foreground">
                          Guardian
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          Contact
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Baby className="h-3.5 w-3.5" />
                            Children
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.guardians.map((g) => (
                        <tr key={g.guardianEmail} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3">
                            <Link
                              href={`/guardians/${encodeURIComponent(g.guardianEmail)}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {g.guardianName}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                <Mail className="h-3 w-3" />
                                <a
                                  href={`mailto:${g.guardianEmail}`}
                                  className="hover:underline"
                                >
                                  {g.guardianEmail}
                                </a>
                              </div>
                              {g.guardianPhone && (
                                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                  <Phone className="h-3 w-3" />
                                  <a href={`tel:${g.guardianPhone}`} className="hover:underline">
                                    {g.guardianPhone}
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {g.childNames.map((name) => (
                                <Badge
                                  key={name}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
