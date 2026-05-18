import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, FolderOpen, Save, ShieldAlert } from "lucide-react";
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

export default function SettingsPoliciesConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [requireAcknowledgement, setRequireAcknowledgement] = useState(true);
  const [acknowledgementDays, setAcknowledgementDays] = useState("7");

  useEffect(() => {
    if (!settings) return;
    setRequireAcknowledgement(settings.policiesRequireAcknowledgement ?? true);
    setAcknowledgementDays(String(settings.policiesAcknowledgementDays ?? 7));
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          policiesRequireAcknowledgement: requireAcknowledgement,
          policiesAcknowledgementDays: parseInt(acknowledgementDays) || 7,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Policies settings saved" });
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
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Policies &amp; Files Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Acknowledgement</CardTitle>
          <CardDescription>Require staff to confirm they have read new and updated policies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Require acknowledgement</p>
                  <p className="text-xs text-muted-foreground">Staff must mark that they have read a policy when a new version is published.</p>
                </div>
                <Switch checked={requireAcknowledgement} onCheckedChange={setRequireAcknowledgement} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="ack-days">Acknowledgement deadline</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="ack-days"
                    type="number"
                    min={1}
                    max={90}
                    value={acknowledgementDays}
                    onChange={e => setAcknowledgementDays(e.target.value)}
                    disabled={!requireAcknowledgement}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">days to acknowledge</span>
                </div>
                <p className="text-xs text-muted-foreground">Staff who haven't acknowledged within this window will be flagged as overdue.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Policies Settings
        </Button>
      </div>
    </div>
  );
}
