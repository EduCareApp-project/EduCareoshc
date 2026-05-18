import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Newspaper, Save, ShieldAlert } from "lucide-react";
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

export default function SettingsPostsConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [allowGuardianComments, setAllowGuardianComments] = useState(true);
  const [requireCommentApproval, setRequireCommentApproval] = useState(false);
  const [defaultScope, setDefaultScope] = useState("all_sites");

  useEffect(() => {
    if (!settings) return;
    setAllowGuardianComments(settings.postsAllowGuardianComments ?? true);
    setRequireCommentApproval(settings.postsRequireCommentApproval ?? false);
    setDefaultScope(settings.postsDefaultScope ?? "all_sites");
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          postsAllowGuardianComments: allowGuardianComments,
          postsRequireCommentApproval: requireCommentApproval,
          postsDefaultScope: defaultScope as "all_sites" | "own_site",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Posts settings saved" });
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
          <Newspaper className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Posts Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guardian Interaction</CardTitle>
          <CardDescription>Control how guardians can interact with posts in the portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Allow guardian comments</p>
                  <p className="text-xs text-muted-foreground">Guardians can comment on posts published to the guardian portal.</p>
                </div>
                <Switch checked={allowGuardianComments} onCheckedChange={setAllowGuardianComments} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Require comment approval</p>
                  <p className="text-xs text-muted-foreground">Guardian comments must be approved by staff before they are visible.</p>
                </div>
                <Switch
                  checked={requireCommentApproval}
                  onCheckedChange={setRequireCommentApproval}
                  disabled={!allowGuardianComments}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>Default behaviour when creating new posts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="space-y-2">
              <Label>Default post visibility scope</Label>
              <Select value={defaultScope} onValueChange={setDefaultScope}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_sites">All sites</SelectItem>
                  <SelectItem value="own_site">Own site only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Determines which sites a post is visible to by default.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Posts Settings
        </Button>
      </div>
    </div>
  );
}
