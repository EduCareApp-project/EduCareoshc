import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetKidsoftSetupQueryKey, useGetKidsoftSetup, useUpdateKidsoftMapping } from "@workspace/api-client-react";
import { Loader2, Save, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/components/kidsoft-utils";

export function KidsoftSettingsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, error, refetch } = useGetKidsoftSetup({ query: { queryKey: getGetKidsoftSetupQueryKey() } });
  const update = useUpdateKidsoftMapping();
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  async function save(siteId: number, serviceId: string | null) {
    setBusy(siteId);
    setErrors((e) => ({ ...e, [siteId]: "" }));
    try {
      await update.mutateAsync({ siteId, data: { serviceId } });
      setDraft((d) => { const n = { ...d }; delete n[siteId]; return n; });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetKidsoftSetupQueryKey() }),
        queryClient.invalidateQueries({ queryKey: ["schools", siteId, "portal"] }),
        queryClient.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).toLowerCase().includes("kidsoft") }),
      ]);
      toast({ title: serviceId ? "Kidsoft service linked" : "Kidsoft service unlinked" });
    } catch (err) {
      setErrors((e) => ({ ...e, [siteId]: apiErrorMessage(err, "Unable to save this link. Please try again.") }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card data-testid="panel-kidsoft-settings">
      <CardHeader>
        <CardTitle>Kidsoft Roll service links</CardTitle>
        <CardDescription>
          Link each EduCare service to its Kidsoft Active service. To show the roll to a school, also switch on Daily Bookings above and save settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="border-t pt-6">
        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : isError || !data ? (
          <div className="space-y-3 text-sm">
            <p className="text-destructive" data-testid="text-kidsoft-setup-error">{apiErrorMessage(error, "Kidsoft services could not be loaded.")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-kidsoft-setup">Retry</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {!data.connected && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Kidsoft is not connected for this organisation, so no services are available to link.</p>}
            {data.sites.map((s) => {
              const value = draft[s.siteId] ?? s.serviceId ?? "";
              const dirty = value !== (s.serviceId ?? "");
              return (
                <div key={s.siteId} className="rounded-lg border p-3" data-testid={`row-kidsoft-site-${s.siteId}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.siteName}</p>
                      <p className="text-xs text-muted-foreground">{s.serviceName ? `Linked to ${s.serviceName}` : "Not linked"}</p>
                    </div>
                    <select
                      aria-label={`Kidsoft service for ${s.siteName}`}
                      className="h-9 rounded-md border bg-background px-2 text-sm sm:w-64"
                      value={value}
                      disabled={!data.connected || busy === s.siteId}
                      onChange={(e) => setDraft((d) => ({ ...d, [s.siteId]: e.target.value }))}
                      data-testid={`select-kidsoft-service-${s.siteId}`}
                    >
                      <option value="">Select a service</option>
                      {data.services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!dirty || !value || busy === s.siteId} onClick={() => save(s.siteId, value)} data-testid={`button-save-kidsoft-${s.siteId}`}>
                        {busy === s.siteId ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save
                      </Button>
                      {s.serviceId && (
                        <Button size="sm" variant="outline" disabled={busy === s.siteId} onClick={() => save(s.siteId, null)} data-testid={`button-unlink-kidsoft-${s.siteId}`}>
                          <Unlink className="mr-1 h-4 w-4" />Unlink
                        </Button>
                      )}
                    </div>
                  </div>
                  {errors[s.siteId] && <p role="alert" className="mt-2 text-xs text-destructive">{errors[s.siteId]}</p>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
