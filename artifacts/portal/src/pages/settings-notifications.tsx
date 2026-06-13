import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Bell, Save, RotateCcw, Mail, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotificationSettings,
  getListNotificationSettingsQueryKey,
  useUpdateNotificationSettings,
  useListSites,
  useGetFeatureSettings,
  getGetFeatureSettingsQueryKey,
  useUpdateFeatureSettings,
} from "@workspace/api-client-react";

// ─── Settings tab metadata ──────────────────────────────────────────────────

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
  observation_comment: {
    label: "Comment on an observation",
    description: "Notify the observation author and prior commenters when a new comment is added.",
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
    label: "Calendar published",
    description: "Email guardians when a calendar program is published.",
    hasAdvanceDays: false,
    group: "Guardian Emails",
  },
  welfare_note_submitted: {
    label: "Welfare note added or updated",
    description: "Notify Admins whenever any welfare note is created or edited for a child.",
    hasAdvanceDays: false,
    group: "Events",
  },
  welfare_mandatory_report: {
    label: "Mandatory report submitted",
    description: "Notify Admins, Coordinators and Educational Leaders when a welfare note flagged as a mandatory report is created or updated.",
    hasAdvanceDays: false,
    group: "Events",
  },
};

const GROUPS = ["Deadline Reminders", "Events", "Guardian Emails"];

type SettingRow = {
  type: string;
  enabled: boolean;
  advanceDays?: number | null;
  siteId?: number | null;
};

// ─── Mapping tab metadata ────────────────────────────────────────────────────

type MappingEvent = {
  key: string;
  label: string;
  description: string;
  group: "Guardian Notifications" | "Staff Events" | "Deadline Reminders";
  audience: "guardian" | "staff";
  emailImpl: boolean;
  inAppImpl: boolean;
  defaultEmail: boolean;
  defaultInApp: boolean;
};

const MAPPING_EVENTS: MappingEvent[] = [
  // Guardian Notifications
  {
    key: "guardian_notice", label: "Notice posted",
    description: "Sent to guardians when a new service notice is published.",
    group: "Guardian Notifications", audience: "guardian",
    emailImpl: true, inAppImpl: false, defaultEmail: true, defaultInApp: false,
  },
  {
    key: "guardian_post", label: "Learning story published",
    description: "Sent to guardians when a learning story or post is published for their child.",
    group: "Guardian Notifications", audience: "guardian",
    emailImpl: true, inAppImpl: false, defaultEmail: true, defaultInApp: false,
  },
  {
    key: "guardian_weekly_plan", label: "Weekly plan published",
    description: "Sent to guardians when a weekly learning plan is published for their child's site.",
    group: "Guardian Notifications", audience: "guardian",
    emailImpl: true, inAppImpl: false, defaultEmail: true, defaultInApp: false,
  },
  {
    key: "guardian_medication", label: "Medication administered",
    description: "Sent to guardians when medication is administered to their child.",
    group: "Guardian Notifications", audience: "guardian",
    emailImpl: true, inAppImpl: false, defaultEmail: true, defaultInApp: false,
  },
  {
    key: "guardian_behavioural", label: "Behavioural notification",
    description: "Sent to guardians when a behavioural incident is logged for their child.",
    group: "Guardian Notifications", audience: "guardian",
    emailImpl: true, inAppImpl: false, defaultEmail: true, defaultInApp: false,
  },
  {
    key: "guardian_welcome", label: "New enrolment welcome",
    description: "Welcome email sent to families when a new child is enrolled.",
    group: "Guardian Notifications", audience: "guardian",
    emailImpl: true, inAppImpl: false, defaultEmail: true, defaultInApp: false,
  },
  // Staff Events
  {
    key: "incident_submitted", label: "Incident submitted",
    description: "Notifies Educational Leaders and Admins when an incident is logged.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "incident_closed", label: "Incident closed",
    description: "Notifies the site Coordinator when an incident is resolved.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "condition_submitted", label: "Condition report submitted",
    description: "Notifies Educational Leaders and Admins when a condition report is filed.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "condition_closed", label: "Condition report closed",
    description: "Notifies the site Coordinator when a condition report is closed.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "post_comment", label: "Comment on post",
    description: "Notifies the post author when a new comment is added.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "observation_comment", label: "Comment on observation",
    description: "Notifies the observation author when a new comment is added.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "appraisal_submitted", label: "Appraisal submitted",
    description: "Notifies the relevant party when an appraisal stage is submitted.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "policy_new", label: "New policy published",
    description: "Notifies relevant staff when a new policy is created.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "policy_updated", label: "Policy updated",
    description: "Notifies staff when a policy version is updated.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "welfare_note_submitted", label: "Welfare note submitted",
    description: "Notifies Admins when a welfare note is created or edited.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "welfare_mandatory_report", label: "Mandatory welfare report",
    description: "Notifies leaders when a mandatory welfare report is flagged.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "medication_administered", label: "Medication administered (staff)",
    description: "Notifies relevant staff when medication is logged for a child.",
    group: "Staff Events", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  // Deadline Reminders
  {
    key: "qip_deadline", label: "QIP deadline approaching",
    description: "Alert when a QIP improvement item is approaching its due date.",
    group: "Deadline Reminders", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "qip_deadline_expired", label: "QIP item overdue",
    description: "Alert when a QIP item has passed its due date.",
    group: "Deadline Reminders", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "staff_qualification_expiry", label: "Staff qualification expiring",
    description: "Alert when a staff qualification is close to expiry.",
    group: "Deadline Reminders", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "weekly_plan_missing", label: "Weekly plan not published",
    description: "Alert when the current week has no published planning experience.",
    group: "Deadline Reminders", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
  {
    key: "checklist_overdue", label: "Checklist overdue",
    description: "Alert when an active checklist is more than 7 days past its target date.",
    group: "Deadline Reminders", audience: "staff",
    emailImpl: false, inAppImpl: true, defaultEmail: false, defaultInApp: true,
  },
];

const MAPPING_GROUPS: MappingEvent["group"][] = ["Guardian Notifications", "Staff Events", "Deadline Reminders"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Settings tab state ───────────────────────────────────────────────────
  const { data: sites } = useListSites();
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  const params = selectedSiteId != null ? { siteId: selectedSiteId } : undefined;
  const settingsQueryKey = getListNotificationSettingsQueryKey(params);

  const { data: rawSettings, isLoading } = useListNotificationSettings(params, {
    query: { queryKey: settingsQueryKey },
  });

  const [local, setLocal] = useState<Record<string, SettingRow>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocal({});
    setDirty(false);
  }, [selectedSiteId]);

  const settings: SettingRow[] = (rawSettings ?? []).map((s) => ({
    type: s.type,
    enabled: local[s.type]?.enabled ?? s.enabled,
    advanceDays: local[s.type]?.advanceDays !== undefined ? local[s.type].advanceDays : s.advanceDays,
    siteId: s.siteId ?? null,
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
    save({
      data: settings.map((s) => ({
        type: s.type,
        enabled: s.enabled,
        advanceDays: s.advanceDays ?? null,
        siteId: selectedSiteId ?? null,
      })),
    });
  }

  function handleReset() {
    setLocal({});
    setDirty(false);
  }

  const multiSite = sites && sites.length > 1;
  const selectedSiteName = sites?.find((s) => s.id === selectedSiteId)?.name;

  // ── Mapping tab state ────────────────────────────────────────────────────
  const fsQueryKey = getGetFeatureSettingsQueryKey();
  const { data: featureSettings, isLoading: fsLoading } = useGetFeatureSettings({
    query: { queryKey: fsQueryKey },
  });
  const updateFs = useUpdateFeatureSettings();

  type ChannelEntry = { email: boolean; inApp: boolean };
  const [channelLocal, setChannelLocal] = useState<Record<string, ChannelEntry>>({});
  const [channelDirty, setChannelDirty] = useState(false);

  function getChannelValue(key: string, field: "email" | "inApp"): boolean {
    if (channelLocal[key] !== undefined) return channelLocal[key][field];
    const stored = (featureSettings?.notificationChannelMap as Record<string, ChannelEntry> | undefined)?.[key];
    if (stored !== undefined && stored[field] !== undefined) return stored[field];
    const event = MAPPING_EVENTS.find((e) => e.key === key);
    return field === "email" ? (event?.defaultEmail ?? false) : (event?.defaultInApp ?? false);
  }

  function setChannelValue(key: string, field: "email" | "inApp", value: boolean) {
    setChannelLocal((prev) => ({
      ...prev,
      [key]: { email: getChannelValue(key, "email"), inApp: getChannelValue(key, "inApp"), [field]: value },
    }));
    setChannelDirty(true);
  }

  function handleChannelSave() {
    const merged: Record<string, ChannelEntry> = {};
    for (const event of MAPPING_EVENTS) {
      merged[event.key] = {
        email: getChannelValue(event.key, "email"),
        inApp: getChannelValue(event.key, "inApp"),
      };
    }
    updateFs.mutate(
      { data: { notificationChannelMap: merged } },
      {
        onSuccess: () => {
          toast({ title: "Notification mapping saved" });
          queryClient.invalidateQueries({ queryKey: fsQueryKey });
          setChannelLocal({});
          setChannelDirty(false);
        },
        onError: () => {
          toast({ title: "Failed to save mapping", variant: "destructive" });
        },
      }
    );
  }

  function handleChannelReset() {
    setChannelLocal({});
    setChannelDirty(false);
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
            Control which events generate notifications and how they are delivered.
          </p>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="mb-2">
          <TabsTrigger value="settings" className="gap-2">
            <Bell className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="mapping" className="gap-2">
            <Mail className="h-3.5 w-3.5" />
            Mapping
          </TabsTrigger>
        </TabsList>

        {/* ── Settings tab ─────────────────────────────────────────────── */}
        <TabsContent value="settings" className="space-y-6 mt-4">
          {multiSite && (
            <div className="flex items-center gap-3">
              <Select
                value={selectedSiteId == null ? "__global__" : String(selectedSiteId)}
                onValueChange={(v) => setSelectedSiteId(v === "__global__" ? null : parseInt(v))}
              >
                <SelectTrigger className="w-[220px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">All sites (global defaults)</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSiteId != null && (
                <p className="text-sm text-muted-foreground">
                  Settings below apply to <span className="font-medium text-foreground">{selectedSiteName}</span> only and override the global defaults.
                </p>
              )}
            </div>
          )}

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
        </TabsContent>

        {/* ── Mapping tab ───────────────────────────────────────────────── */}
        <TabsContent value="mapping" className="space-y-6 mt-4">
          <p className="text-sm text-muted-foreground">
            Control how each notification event is delivered. Uncheck <strong>Email</strong> to stop emails going to inboxes; uncheck <strong>In-App</strong> to suppress the in-app bell notification. Channels marked <span className="text-muted-foreground italic">N/A</span> are not available for that event type.
          </p>

          {fsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <TooltipProvider>
              {MAPPING_GROUPS.map((group) => {
                const events = MAPPING_EVENTS.filter((e) => e.group === group);
                return (
                  <Card key={group} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{group}</CardTitle>
                      {group === "Guardian Notifications" && (
                        <CardDescription>
                          Notifications sent to families. Disable Email to stop emails reaching guardian inboxes.
                        </CardDescription>
                      )}
                      {group === "Staff Events" && (
                        <CardDescription>
                          Real-time notifications for staff. Delivered as in-app bell alerts.
                        </CardDescription>
                      )}
                      {group === "Deadline Reminders" && (
                        <CardDescription>
                          Computed nightly. Shown as in-app alerts for Admins and Educational Leaders.
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      {/* Header row */}
                      <div className="grid grid-cols-[1fr_72px_72px] gap-2 px-6 py-2 border-b bg-muted/40">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event</span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center flex items-center justify-center gap-1">
                          <Mail className="h-3 w-3" /> Email
                        </span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-center flex items-center justify-center gap-1">
                          <BellRing className="h-3 w-3" /> In-App
                        </span>
                      </div>
                      {events.map((event, i) => (
                        <div key={event.key}>
                          {i > 0 && <Separator />}
                          <div className="grid grid-cols-[1fr_72px_72px] gap-2 items-center px-6 py-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{event.label}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-4 px-1.5 ${event.audience === "guardian" ? "border-blue-200 text-blue-700 bg-blue-50" : "border-violet-200 text-violet-700 bg-violet-50"}`}
                                >
                                  {event.audience === "guardian" ? "Guardians" : "Staff"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                            </div>
                            {/* Email checkbox */}
                            <div className="flex items-center justify-center">
                              {event.emailImpl ? (
                                <Checkbox
                                  checked={getChannelValue(event.key, "email")}
                                  onCheckedChange={(v) => setChannelValue(event.key, "email", Boolean(v))}
                                  className="h-4 w-4"
                                />
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground/50 select-none cursor-default">N/A</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Email delivery is not available for this event type.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {/* In-App checkbox */}
                            <div className="flex items-center justify-center">
                              {event.inAppImpl ? (
                                <Checkbox
                                  checked={getChannelValue(event.key, "inApp")}
                                  onCheckedChange={(v) => setChannelValue(event.key, "inApp", Boolean(v))}
                                  className="h-4 w-4"
                                />
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground/50 select-none cursor-default">N/A</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    In-app delivery is not available for this event type.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </TooltipProvider>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleChannelSave} disabled={!channelDirty || updateFs.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {updateFs.isPending ? "Saving…" : "Save mapping"}
            </Button>
            {channelDirty && (
              <Button variant="outline" onClick={handleChannelReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
