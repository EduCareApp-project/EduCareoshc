import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, UserCheck, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

export default function SettingsStaffComplianceConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [warnDays, setWarnDays] = useState("60");
  const [suspendOnExpiry, setSuspendOnExpiry] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setWarnDays(String(settings.staffComplianceWarnDays ?? 60));
    setSuspendOnExpiry(settings.staffComplianceSuspendOnExpiry ?? false);
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          staffComplianceWarnDays: parseInt(warnDays) || 60,
          staffComplianceSuspendOnExpiry: suspendOnExpiry,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Staff Compliance settings saved" });
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
          <UserCheck className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Staff Compliance Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expiry Warnings</CardTitle>
          <CardDescription>How early to alert coordinators of upcoming qualification expiries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="warn-days">Warning lead time</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="warn-days"
                    type="number"
                    min={7}
                    max={180}
                    value={warnDays}
                    onChange={e => setWarnDays(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">days before expiry</span>
                </div>
                <p className="text-xs text-muted-foreground">Coordinators receive a compliance alert when a qualification is within this many days of expiry.</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Suspend portal access on expiry</p>
                  <p className="text-xs text-muted-foreground">Staff whose required qualifications have expired are blocked from logging in until renewed.</p>
                </div>
                <Switch checked={suspendOnExpiry} onCheckedChange={setSuspendOnExpiry} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Staff Compliance Settings
        </Button>
      </div>
    </div>
  );
}
