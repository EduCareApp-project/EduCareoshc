import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, BookMarked, Save, ShieldAlert } from "lucide-react";
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

export default function SettingsLearningStoriesConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [includeMtop, setIncludeMtop] = useState(true);
  const [includePhoto, setIncludePhoto] = useState(true);
  const [defaultSharing, setDefaultSharing] = useState("staff_only");

  useEffect(() => {
    if (!settings) return;
    setIncludeMtop(settings.storiesIncludeMtop ?? true);
    setIncludePhoto(settings.storiesIncludePhoto ?? true);
    setDefaultSharing(settings.storiesDefaultSharing ?? "staff_only");
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          storiesIncludeMtop: includeMtop,
          storiesIncludePhoto: includePhoto,
          storiesDefaultSharing: defaultSharing as "staff_only" | "guardians",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Learning Stories settings saved" });
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
          <BookMarked className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Learning Stories Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Content</CardTitle>
          <CardDescription>What is included in generated learning story reports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Include MTOP outcomes</p>
                  <p className="text-xs text-muted-foreground">List linked My Time Our Place outcomes in each story report.</p>
                </div>
                <Switch checked={includeMtop} onCheckedChange={setIncludeMtop} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Include child photo</p>
                  <p className="text-xs text-muted-foreground">Show the child's profile picture at the top of the report if one is uploaded.</p>
                </div>
                <Switch checked={includePhoto} onCheckedChange={setIncludePhoto} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sharing</CardTitle>
          <CardDescription>Default audience for new learning stories.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <>
              <Label>Default sharing</Label>
              <Select value={defaultSharing} onValueChange={setDefaultSharing}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff_only">Staff only</SelectItem>
                  <SelectItem value="guardians">Guardians &amp; staff</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Stories shared with guardians appear in the guardian portal.</p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Learning Stories Settings
        </Button>
      </div>
    </div>
  );
}
