import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Layers, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useGetFeatureSettings,
  getGetFeatureSettingsQueryKey,
  useUpdateFeatureSettings,
} from "@workspace/api-client-react";

export default function SettingsPlanningConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [cycleDurationWeeks, setCycleDurationWeeks] = useState("2");
  const [requireOutcomes, setRequireOutcomes] = useState(false);
  const [lockAfterPublish, setLockAfterPublish] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setCycleDurationWeeks(String(settings.planningCycleDurationWeeks ?? 2));
    setRequireOutcomes(settings.planningRequireOutcomes ?? false);
    setLockAfterPublish(settings.planningLockAfterPublish ?? false);
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          planningCycleDurationWeeks: parseInt(cycleDurationWeeks) || 2,
          planningRequireOutcomes: requireOutcomes,
          planningLockAfterPublish: lockAfterPublish,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Planning Cycle settings saved" });
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
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Planning Cycle Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cycle Configuration</CardTitle>
          <CardDescription>Define the default length and behaviour of the planning cycle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Planning cycle duration</Label>
                <Select value={cycleDurationWeeks} onValueChange={setCycleDurationWeeks}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 week</SelectItem>
                    <SelectItem value="2">2 weeks</SelectItem>
                    <SelectItem value="4">4 weeks</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How many weeks each planning cycle covers by default.</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Lock programs after publishing</p>
                  <p className="text-xs text-muted-foreground">Published programs cannot be edited without first unpublishing them.</p>
                </div>
                <Switch checked={lockAfterPublish} onCheckedChange={setLockAfterPublish} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
          <CardDescription>Mandatory fields when creating a program experience.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Require MTOP outcome tagging</p>
                <p className="text-xs text-muted-foreground">At least one My Time Our Place outcome must be linked to each program experience.</p>
              </div>
              <Switch checked={requireOutcomes} onCheckedChange={setRequireOutcomes} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Planning Settings
        </Button>
      </div>
    </div>
  );
}
