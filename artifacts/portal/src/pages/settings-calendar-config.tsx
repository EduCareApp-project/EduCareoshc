import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, CalendarDays, Save, ShieldAlert } from "lucide-react";
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

export default function SettingsCalendarConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [defaultView, setDefaultView] = useState("week");
  const [showPublicHolidays, setShowPublicHolidays] = useState(true);
  const [publishByDefault, setPublishByDefault] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setDefaultView(settings.calendarDefaultView ?? "week");
    setShowPublicHolidays(settings.calendarShowPublicHolidays ?? true);
    setPublishByDefault(settings.calendarPublishByDefault ?? false);
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          calendarDefaultView: defaultView as "week" | "month",
          calendarShowPublicHolidays: showPublicHolidays,
          calendarPublishByDefault: publishByDefault,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Calendar settings saved" });
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
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Calendar Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
          <CardDescription>Default calendar view and display options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Default view</Label>
                <Select value={defaultView} onValueChange={setDefaultView}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Show public holiday notes</p>
                  <p className="text-xs text-muted-foreground">Display Australian public holidays on the calendar view.</p>
                </div>
                <Switch checked={showPublicHolidays} onCheckedChange={setShowPublicHolidays} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
          <CardDescription>Default publish behaviour for new calendar programs.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Auto-publish to guardians</p>
                <p className="text-xs text-muted-foreground">New calendar programs are published to the guardian portal by default.</p>
              </div>
              <Switch checked={publishByDefault} onCheckedChange={setPublishByDefault} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Calendar Settings
        </Button>
      </div>
    </div>
  );
}
