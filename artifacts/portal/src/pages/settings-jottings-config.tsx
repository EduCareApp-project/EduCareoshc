import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, StickyNote, Save, ShieldAlert } from "lucide-react";
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

export default function SettingsJottingsConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [visibleToGuardians, setVisibleToGuardians] = useState(false);
  const [requireChild, setRequireChild] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setVisibleToGuardians(settings.jottingsVisibleToGuardians ?? false);
    setRequireChild(settings.jottingsRequireChild ?? false);
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          jottingsVisibleToGuardians: visibleToGuardians,
          jottingsRequireChild: requireChild,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Jottings settings saved" });
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
          <StickyNote className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Jottings Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sharing &amp; Tagging</CardTitle>
          <CardDescription>Visibility and tagging requirements for jottings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Show jottings to guardians</p>
                  <p className="text-xs text-muted-foreground">Jottings linked to a child are visible to that child's guardians in the portal.</p>
                </div>
                <Switch checked={visibleToGuardians} onCheckedChange={setVisibleToGuardians} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Require a child tag on each jotting</p>
                  <p className="text-xs text-muted-foreground">Jottings cannot be saved without tagging at least one child.</p>
                </div>
                <Switch checked={requireChild} onCheckedChange={setRequireChild} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Jottings Settings
        </Button>
      </div>
    </div>
  );
}
