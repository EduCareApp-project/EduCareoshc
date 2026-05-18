import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, UserCog, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

export default function SettingsGuardians() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [allowComments, setAllowComments] = useState(true);
  const [showLearningStories, setShowLearningStories] = useState(true);
  const [showObservations, setShowObservations] = useState(false);
  const [requireEmail, setRequireEmail] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");

  useEffect(() => {
    if (!settings) return;
    setAllowComments(settings.guardianAllowComments ?? true);
    setShowLearningStories(settings.guardianShowLearningStories ?? true);
    setShowObservations(settings.guardianShowObservations ?? false);
    setRequireEmail(settings.guardianRequireEmail ?? true);
    setWelcomeMessage(settings.guardianWelcomeMessage ?? "");
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          guardianAllowComments: allowComments,
          guardianShowLearningStories: showLearningStories,
          guardianShowObservations: showObservations,
          guardianRequireEmail: requireEmail,
          guardianWelcomeMessage: welcomeMessage.trim() || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Guardian settings saved" });
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
          <UserCog className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Guardian Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portal Access</CardTitle>
          <CardDescription>Control what guardians can see and do in the guardian portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Allow comments on posts</p>
                  <p className="text-xs text-muted-foreground">Guardians can leave comments on published posts.</p>
                </div>
                <Switch checked={allowComments} onCheckedChange={setAllowComments} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Show learning stories</p>
                  <p className="text-xs text-muted-foreground">Guardians can view learning stories published for their child.</p>
                </div>
                <Switch checked={showLearningStories} onCheckedChange={setShowLearningStories} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Show observations</p>
                  <p className="text-xs text-muted-foreground">Guardians can view observation records linked to their child.</p>
                </div>
                <Switch checked={showObservations} onCheckedChange={setShowObservations} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrolment Requirements</CardTitle>
          <CardDescription>Fields required when enrolling a new child.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Require guardian email</p>
                <p className="text-xs text-muted-foreground">An email address must be provided when enrolling a child.</p>
              </div>
              <Switch checked={requireEmail} onCheckedChange={setRequireEmail} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Welcome Message</CardTitle>
          <CardDescription>Optional message shown at the top of the guardian portal home screen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-20 bg-muted/30 rounded animate-pulse" />
          ) : (
            <>
              <Label htmlFor="welcome-msg">Message text</Label>
              <Textarea
                id="welcome-msg"
                value={welcomeMessage}
                onChange={e => setWelcomeMessage(e.target.value)}
                placeholder="e.g. Welcome to the EduCare family portal! We're glad to have you here."
                rows={3}
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground text-right">{welcomeMessage.length}/300</p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Guardian Settings
        </Button>
      </div>
    </div>
  );
}
