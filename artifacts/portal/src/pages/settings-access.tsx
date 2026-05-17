import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type AccessSettings = Record<string, string[]>;

const STAFF_ITEMS: { href: string; label: string; group: string }[] = [
  { href: "/children",            label: "Children",              group: "People" },
  { href: "/guardians",           label: "Guardians",             group: "People" },
  { href: "/staff",               label: "Staff",                 group: "People" },
  { href: "/calendar",            label: "Calendar",              group: "Programming" },
  { href: "/planning",            label: "Planning Cycle",        group: "Programming" },
  { href: "/posts",               label: "Posts",                 group: "Learning" },
  { href: "/jottings",            label: "Jottings",              group: "Learning" },
  { href: "/observations",        label: "Observations",          group: "Learning" },
  { href: "/programs",            label: "Programs",              group: "Learning" },
  { href: "/outcomes",            label: "MTOP Outcomes",         group: "Learning" },
  { href: "/incidents",           label: "Incident Log",          group: "Service Operations" },
  { href: "/condition-reports",   label: "Condition Report",      group: "Service Operations" },
  { href: "/evacuations",         label: "Safety Evacuation",     group: "Service Operations" },
  { href: "/qip",                 label: "QIP",                   group: "Service Operations" },
  { href: "/policies",            label: "Policies & Files",      group: "Service Operations" },
  { href: "/checklists",          label: "Checklists",            group: "Service Operations" },
  { href: "/reports/learning",    label: "Learning Stories",      group: "Reports" },
  { href: "/reports/service",     label: "Service Compliance",    group: "Reports" },
  { href: "/reports/staff",       label: "Staff Compliance",      group: "Reports" },
  { href: "/reports/system-access", label: "System Access",       group: "Reports" },
  { href: "/appraisals",          label: "Appraisals",            group: "Reports" },
  { href: "/sites",               label: "Sites",                 group: "System" },
  { href: "/settings",            label: "Settings",              group: "System" },
];

const GUARDIAN_ITEMS: { href: string; label: string; group: string }[] = [
  { href: "guardian_posts",        label: "Posts & Updates",              group: "Dashboard" },
  { href: "guardian_qip",          label: "QIP Button",                   group: "Dashboard" },
  { href: "guardian_service_docs", label: "Service Documentation Button", group: "Dashboard" },
];

const TABS = [
  { key: "educational_leader", label: "Educational Leader", items: STAFF_ITEMS },
  { key: "educator",           label: "Educators",          items: STAFF_ITEMS },
  { key: "guardian",           label: "Guardians",          items: GUARDIAN_ITEMS },
];

function groupItems(items: typeof STAFF_ITEMS) {
  const groups: Record<string, typeof STAFF_ITEMS> = {};
  for (const item of items) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }
  return groups;
}

export default function SettingsAccess() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AccessSettings>({
    queryKey: ["settings-access"],
    queryFn: async () => {
      const res = await fetch("/api/settings/access");
      if (!res.ok) throw new Error("Failed to load access settings");
      return res.json();
    },
  });

  const [draft, setDraft] = useState<AccessSettings | null>(null);
  const settings: AccessSettings = draft ?? data ?? {};

  const isEnabled = (role: string, href: string) =>
    !(settings[role] ?? []).includes(href);

  const toggle = (role: string, href: string) => {
    const current = settings[role] ?? [];
    const next = current.includes(href)
      ? current.filter((h) => h !== href)
      : [...current, href];
    setDraft({ ...settings, [role]: next });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: AccessSettings) => {
      const res = await fetch("/api/settings/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json() as Promise<AccessSettings>;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["settings-access"], saved);
      setDraft(null);
      toast({ title: "Access settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    },
  });

  const isDirty = draft !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Access</h1>
          <p className="text-muted-foreground mt-0.5">
            Control which menu items are visible for each user role.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : (
        <Tabs defaultValue="educational_leader">
          <TabsList className="mb-6">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => {
            const grouped = groupItems(tab.items);
            return (
              <TabsContent key={tab.key} value={tab.key} className="space-y-6 mt-0">
                {Object.entries(grouped).map(([groupName, items]) => (
                  <div key={groupName}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                      {groupName}
                    </p>
                    <div className="rounded-lg border divide-y">
                      {items.map((item) => {
                        const enabled = isEnabled(tab.key, item.href);
                        return (
                          <div
                            key={item.href}
                            className="flex items-center justify-between px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <ShieldCheck
                                className={`h-4 w-4 shrink-0 ${enabled ? "text-emerald-500" : "text-muted-foreground/40"}`}
                              />
                              <span className={`text-sm font-medium ${enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
                                {item.label}
                              </span>
                            </div>
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => toggle(tab.key, item.href)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => saveMutation.mutate(settings)}
                    disabled={!isDirty || saveMutation.isPending}
                  >
                    {saveMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
