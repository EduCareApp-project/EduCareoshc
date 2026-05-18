import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, BookOpen, Save, ShieldAlert } from "lucide-react";
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

export default function SettingsObservationsConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [requireMtop, setRequireMtop] = useState(false);
  const [defaultType, setDefaultType] = useState("individual");
  const [visibleToPeers, setVisibleToPeers] = useState(true);

  useEffect(() => {
    if (!settings) return;
    setRequireMtop(settings.observationsRequireMtop ?? false);
    setDefaultType(settings.observationsDefaultType ?? "individual");
    setVisibleToPeers(settings.observationsVisibleToPeers ?? true);
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          observationsRequireMtop: requireMtop,
          observationsDefaultType: defaultType as "individual" | "group",
          observationsVisibleToPeers: visibleToPeers,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Observations settings saved" });
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
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Observations Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Observation Defaults</CardTitle>
          <CardDescription>Default values applied when creating a new observation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Default observation type</Label>
                <Select value={defaultType} onValueChange={setDefaultType}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Require MTOP outcome tagging</p>
                  <p className="text-xs text-muted-foreground">At least one My Time Our Place outcome must be selected when saving an observation.</p>
                </div>
                <Switch checked={requireMtop} onCheckedChange={setRequireMtop} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Who can view observations across the service.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Visible to all educators</p>
                <p className="text-xs text-muted-foreground">All educators at the same site can view each other's observations.</p>
              </div>
              <Switch checked={visibleToPeers} onCheckedChange={setVisibleToPeers} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Observations Settings
        </Button>
      </div>
    </div>
  );
}
