import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, ShieldAlert as EvacIcon, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function SettingsEvacuationConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [drillFrequencyDays, setDrillFrequencyDays] = useState("90");
  const [drillReminderDays, setDrillReminderDays] = useState("14");

  useEffect(() => {
    if (!settings) return;
    setDrillFrequencyDays(String(settings.evacuationDrillFrequencyDays ?? 90));
    setDrillReminderDays(String(settings.evacuationDrillReminderDays ?? 14));
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          evacuationDrillFrequencyDays: parseInt(drillFrequencyDays) || 90,
          evacuationDrillReminderDays: parseInt(drillReminderDays) || 14,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Safety Evacuation settings saved" });
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
          <EvacIcon className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Safety Evacuation Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drill Schedule</CardTitle>
          <CardDescription>How frequently evacuation drills must be conducted and when to send reminders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="freq-days">Required drill frequency</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="freq-days"
                    type="number"
                    min={7}
                    max={365}
                    value={drillFrequencyDays}
                    onChange={e => setDrillFrequencyDays(e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  A drill is considered overdue if no evacuation has been recorded within this period.
                  National Regulations require at least every 3 months (90 days).
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="remind-days">Reminder lead time</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="remind-days"
                    type="number"
                    min={1}
                    max={60}
                    value={drillReminderDays}
                    onChange={e => setDrillReminderDays(e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">days before due</span>
                </div>
                <p className="text-xs text-muted-foreground">Send a reminder notification this many days before the next drill is due.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Evacuation Settings
        </Button>
      </div>
    </div>
  );
}
