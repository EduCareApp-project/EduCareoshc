import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Bell, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotificationSettings,
  getListNotificationSettingsQueryKey,
  useUpdateNotificationSettings,
} from "@workspace/api-client-react";

const SETTING_META: Record<string, { label: string; description: string; hasAdvanceDays: boolean; group: string }> = {
  qip_deadline: {
    label: "QIP item due soon",
    description: "Alert when a QIP improvement item is approaching its due date.",
    hasAdvanceDays: true,
    group: "Deadline Reminders",
  },
  qip_deadline_expired: {
    label: "QIP item overdue",
    description: "Alert when a QIP improvement item has passed its due date without being resolved.",
    hasAdvanceDays: false,
    group: "Deadline Reminders",
  },
  staff_qualification_expiry: {
    label: "Staff qualification expiring",
    description: "Alert when a staff qualification (e.g. First Aid, WWCC) is close to expiry.",
    hasAdvanceDays: true,
    group: "Deadline Reminders",
  },
  weekly_plan_missing: {
    label: "Weekly plan not published",
    description: "Alert when the current week has no published planning experience.",
    hasAdvanceDays: false,
    group: "Deadline Reminders",
  },
  checklist_overdue: {
    label: "Checklist overdue",
    description: "Alert when an active checklist is more than 7 days past its target date.",
    hasAdvanceDays: false,
    group: "Deadline Reminders",
  },
  incident_submitted: {
    label: "New incident log submitted",
    description: "Notify Educational Leaders and Admins when a new incident is logged.",
    hasAdvanceDays: false,
    group: "Events",
  },
  incident_closed: {
    label: "Incident log closed",
    description: "Notify the site Coordinator when an incident is marked resolved or closed.",
    hasAdvanceDays: false,
    group: "Events",
  },
  condition_submitted: {
    label: "New condition report submitted",
    description: "Notify Educational Leaders and Admins when a condition report is filed.",
    hasAdvanceDays: false,
    group: "Events",
  },
  condition_closed: {
    label: "Condition report closed",
    description: "Notify the site Coordinator when a condition report is closed.",
    hasAdvanceDays: false,
    group: "Events",
  },
  post_comment: {
    label: "Comment on your post",
    description: "Notify the post author when a new comment is added.",
    hasAdvanceDays: false,
    group: "Events",
  },
  appraisal_submitted: {
    label: "Appraisal stage submitted",
    description: "Notify the relevant party when an appraisal stage is submitted (employee → reviewer, reviewer → employee, completion).",
    hasAdvanceDays: false,
    group: "Events",
  },
  policy_new: {
    label: "New policy added",
    description: "Notify relevant staff when a new policy is created.",
    hasAdvanceDays: false,
    group: "Events",
  },
  policy_updated: {
    label: "Policy version updated",
    description: "Notify staff who have not yet acknowledged a policy when a new version is published.",
    hasAdvanceDays: false,
    group: "Events",
  },
  planning_published: {
    label: "Weekly program published",
    description: "Email guardians when a weekly program is published.",
    hasAdvanceDays: false,
    group: "Guardian Emails",
  },
};

const GROUPS = ["Deadline Reminders", "Events", "Guardian Emails"];

type SettingRow = {
  type: string;
  enabled: boolean;
  advanceDays?: number | null;
};

export default function SettingsNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settingsQueryKey = getListNotificationSettingsQueryKey();
  const { data: rawSettings, isLoading } = useListNotificationSettings({
    query: { queryKey: settingsQueryKey },
  });

  const [local, setLocal] = useState<Record<string, SettingRow>>({});
  const [dirty, setDirty] = useState(false);

  const settings: SettingRow[] = (rawSettings ?? []).map((s) => ({
    type: s.type,
    enabled: local[s.type]?.enabled ?? s.enabled,
    advanceDays: local[s.type]?.advanceDays !== undefined ? local[s.type].advanceDays : s.advanceDays,
  }));

  const { mutate: save, isPending } = useUpdateNotificationSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Notification settings saved" });
        queryClient.invalidateQueries({ queryKey: settingsQueryKey });
        setLocal({});
        setDirty(false);
      },
      onError: () => {
        toast({ title: "Failed to save settings", variant: "destructive" });
      },
    },
  });

  function setEnabled(type: string, enabled: boolean) {
    setLocal((prev) => ({ ...prev, [type]: { ...prev[type], type, enabled } }));
    setDirty(true);
  }

  function setAdvanceDays(type: string, days: number) {
    setLocal((prev) => ({ ...prev, [type]: { ...prev[type], type, advanceDays: days } }));
    setDirty(true);
  }

  function handleSave() {
    save({ data: settings.map((s) => ({ type: s.type, enabled: s.enabled, advanceDays: s.advanceDays ?? null })) });
  }

  function handleReset() {
    setLocal({});
    setDirty(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control which events generate in-app notifications and how far in advance deadline alerts appear.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {GROUPS.map((group) => {
            const groupSettings = settings.filter((s) => SETTING_META[s.type]?.group === group);
            if (groupSettings.length === 0) return null;
            return (
              <Card key={group}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{group}</CardTitle>
                  {group === "Deadline Reminders" && (
                    <CardDescription>
                      Deadline alerts are computed nightly and shown to Admins and Educational Leaders. "Advance days" controls how early the alert appears before the due date.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-0 p-0">
                  {groupSettings.map((s, i) => {
                    const meta = SETTING_META[s.type];
                    if (!meta) return null;
                    return (
                      <div key={s.type}>
                        {i > 0 && <Separator />}
                        <div className="flex items-start gap-4 px-6 py-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`sw-${s.type}`} className="text-sm font-medium cursor-pointer">
                                {meta.label}
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground">{meta.description}</p>
                            {meta.hasAdvanceDays && s.enabled && (
                              <div className="flex items-center gap-2 pt-2">
                                <Label htmlFor={`days-${s.type}`} className="text-xs text-muted-foreground whitespace-nowrap">
                                  Alert
                                </Label>
                                <Input
                                  id={`days-${s.type}`}
                                  type="number"
                                  min={1}
                                  max={90}
                                  value={s.advanceDays ?? 14}
                                  onChange={(e) => setAdvanceDays(s.type, Number(e.target.value))}
                                  className="h-7 w-20 text-xs"
                                />
                                <Label htmlFor={`days-${s.type}`} className="text-xs text-muted-foreground whitespace-nowrap">
                                  days before due date
                                </Label>
                              </div>
                            )}
                          </div>
                          <Switch
                            id={`sw-${s.type}`}
                            checked={s.enabled}
                            onCheckedChange={(v) => setEnabled(s.type, v)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={!dirty || isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {isPending ? "Saving…" : "Save changes"}
            </Button>
            {dirty && (
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
