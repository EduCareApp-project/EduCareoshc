import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Users, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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

export default function SettingsStaffConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [requireWwcc, setRequireWwcc] = useState(true);
  const [appraisalCycle, setAppraisalCycle] = useState("365");
  const [profilesVisibleToPeers, setProfilesVisibleToPeers] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setRequireWwcc(settings.staffRequireWwcc ?? true);
    setAppraisalCycle(String(settings.staffAppraisalCycleDays ?? 365));
    setProfilesVisibleToPeers(settings.staffProfilesVisibleToPeers ?? false);
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          staffRequireWwcc: requireWwcc,
          staffAppraisalCycleDays: parseInt(appraisalCycle) || 365,
          staffProfilesVisibleToPeers: profilesVisibleToPeers,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Staff settings saved" });
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
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Staff Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Requirements</CardTitle>
          <CardDescription>Mandatory credentials and checks for all staff members.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Require WWCC for all staff</p>
                <p className="text-xs text-muted-foreground">A Working With Children Check number must be recorded for every staff member.</p>
              </div>
              <Switch checked={requireWwcc} onCheckedChange={setRequireWwcc} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appraisals</CardTitle>
          <CardDescription>Default appraisal schedule and visibility settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Default appraisal cycle</Label>
                <Select value={appraisalCycle} onValueChange={setAppraisalCycle}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">Quarterly (90 days)</SelectItem>
                    <SelectItem value="180">Semi-annual (180 days)</SelectItem>
                    <SelectItem value="365">Annual (365 days)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How often staff appraisals are scheduled by default.</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Staff profiles visible to peers</p>
                  <p className="text-xs text-muted-foreground">Allow educators to view each other's staff profiles and qualifications.</p>
                </div>
                <Switch checked={profilesVisibleToPeers} onCheckedChange={setProfilesVisibleToPeers} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Staff Settings
        </Button>
      </div>
    </div>
  );
}
