import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, AlertTriangle, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useGetFeatureSettings,
  getGetFeatureSettingsQueryKey,
  useUpdateFeatureSettings,
} from "@workspace/api-client-react";

export default function SettingsIncidentsConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [notifyGuardians, setNotifyGuardians] = useState(false);
  const [notifyAllSites, setNotifyAllSites] = useState(false);
  const [requireFollowUp, setRequireFollowUp] = useState(true);

  useEffect(() => {
    if (!settings) return;
    setNotifyGuardians(settings.incidentNotifyGuardians ?? false);
    setNotifyAllSites(settings.incidentNotifyAllSites ?? false);
    setRequireFollowUp(settings.incidentRequireFollowUp ?? true);
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          incidentNotifyGuardians: notifyGuardians,
          incidentNotifyAllSites: notifyAllSites,
          incidentRequireFollowUp: requireFollowUp,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Incident Log settings saved" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  if (!isFullAccess) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">These settings are restricted to Admin and Educational Leader users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Incident Log Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Who is alerted when a new incident is logged.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Notify guardian of incident</p>
                  <p className="text-xs text-muted-foreground">Send an email notification to the child's guardian when an incident is logged.</p>
                </div>
                <Switch checked={notifyGuardians} onCheckedChange={setNotifyGuardians} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Notify all sites</p>
                  <p className="text-xs text-muted-foreground">Send notifications to Educational Leaders and Admins across all sites, not just the incident's site.</p>
                </div>
                <Switch checked={notifyAllSites} onCheckedChange={setNotifyAllSites} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Process</CardTitle>
          <CardDescription>Requirements for closing an incident log.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Require follow-up notes before closing</p>
                <p className="text-xs text-muted-foreground">A coordinator must add follow-up notes before an incident can be marked as closed.</p>
              </div>
              <Switch checked={requireFollowUp} onCheckedChange={setRequireFollowUp} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Incident Settings
        </Button>
      </div>
    </div>
  );
}
