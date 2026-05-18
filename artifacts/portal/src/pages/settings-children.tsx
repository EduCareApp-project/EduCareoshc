import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Baby, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetChildSettings,
  getGetChildSettingsQueryKey,
  useUpdateChildSettings,
  useGetFeatureSettings,
  getGetFeatureSettingsQueryKey,
  useUpdateFeatureSettings,
} from "@workspace/api-client-react";

export default function SettingsChildren() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: childLoading } = useGetChildSettings({
    query: { queryKey: getGetChildSettingsQueryKey() },
  });
  const { data: featureSettings, isLoading: featureLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });

  const updateChild = useUpdateChildSettings();
  const updateFeatures = useUpdateFeatureSettings();

  const isLoading = childLoading || featureLoading;

  const [mode, setMode] = useState<"letter_icon" | "profile_picture">("letter_icon");
  const [requireMedicalNotes, setRequireMedicalNotes] = useState(false);
  const [showDobOnProfile, setShowDobOnProfile] = useState(false);

  useEffect(() => {
    if (settings?.childDisplayMode) {
      setMode(settings.childDisplayMode as "letter_icon" | "profile_picture");
    }
  }, [settings]);

  useEffect(() => {
    if (!featureSettings) return;
    setRequireMedicalNotes(featureSettings.childrenRequireMedicalNotes ?? false);
    setShowDobOnProfile(featureSettings.childrenShowDobOnProfile ?? false);
  }, [featureSettings]);

  function handleSaveDisplay() {
    updateChild.mutate(
      { data: { childDisplayMode: mode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChildSettingsQueryKey() });
          toast({ title: "Display setting saved" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  function handleSaveProfile() {
    updateFeatures.mutate(
      {
        data: {
          childrenRequireMedicalNotes: requireMedicalNotes,
          childrenShowDobOnProfile: showDobOnProfile,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Profile settings saved" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-2">
          <Baby className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Children Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Display</CardTitle>
          <CardDescription>
            Choose how children are displayed throughout the portal — using their initials as an icon, or with an uploaded profile picture.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-24 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="space-y-3">
              <label
                htmlFor="mode-letter"
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  mode === "letter_icon"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  id="mode-letter"
                  name="childDisplayMode"
                  value="letter_icon"
                  checked={mode === "letter_icon"}
                  onChange={() => setMode("letter_icon")}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold select-none">
                      AB
                    </div>
                    <Label htmlFor="mode-letter" className="font-semibold cursor-pointer">Letter Icon</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Display each child's initials in a coloured circle. No photo upload is required.
                  </p>
                </div>
              </label>

              <label
                htmlFor="mode-photo"
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  mode === "profile_picture"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  id="mode-photo"
                  name="childDisplayMode"
                  value="profile_picture"
                  checked={mode === "profile_picture"}
                  onChange={() => setMode("profile_picture")}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-10 w-10 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <Baby className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <Label htmlFor="mode-photo" className="font-semibold cursor-pointer">Profile Picture</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Display an uploaded photo for each child. A letter icon is shown as a fallback until a photo is uploaded.
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="pt-2 flex justify-end border-t">
            <Button onClick={handleSaveDisplay} disabled={updateChild.isPending || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Control what information is displayed and required on child profiles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Show date of birth on profile</p>
                  <p className="text-xs text-muted-foreground">Display the child's date of birth and age on their profile card.</p>
                </div>
                <Switch checked={showDobOnProfile} onCheckedChange={setShowDobOnProfile} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Require medical notes on enrolment</p>
                  <p className="text-xs text-muted-foreground">Medical conditions and allergy notes must be completed before an enrolment can be saved.</p>
                </div>
                <Switch checked={requireMedicalNotes} onCheckedChange={setRequireMedicalNotes} />
              </div>
            </>
          )}

          <div className="pt-2 flex justify-end border-t">
            <Button onClick={handleSaveProfile} disabled={updateFeatures.isPending || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
