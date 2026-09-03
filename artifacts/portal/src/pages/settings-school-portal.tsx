import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, GraduationCap, Loader2, Save, School, ShieldAlert } from "lucide-react";
import {
  getGetFeatureSettingsQueryKey,
  useGetFeatureSettings,
  useUpdateFeatureSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";

const PORTAL_AREAS = [
  { id: "vital", label: "Vital Records", description: "Licences, certificates and school compliance records." },
  { id: "vecra", label: "VECRA Visits", description: "Visit details, findings, actions and follow-up dates." },
  { id: "staff", label: "Service Staff", description: "Staff assigned to or associated with the school." },
  { id: "reports", label: "Reports", description: "Current school reports shared with the school account." },
  { id: "qip", label: "QIP", description: "The school's current Quality Improvement Plan." },
] as const;

const DEFAULT_QUALIFICATIONS = [
  "Child Safety - Foundation Child Safety Training (GECCKO)",
  "Child Safety - Mandatory Reporting and Other Obligations",
  "Child Wellbeing",
  "CPR Renewal",
  "Education Qualifications",
  "First Aid",
  "Food Safety",
  "History & Compliance",
  "Managing Challenging Behaviour (DET)",
  "National Police Check",
  "Responsible Person Declaration",
  "Resume",
  "Risk Management (DET)",
  "Staff Details (DET)",
  "WWCC",
];

type PortalArea = typeof PORTAL_AREAS[number]["id"];

export default function SettingsSchoolPortal() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateSettings = useUpdateFeatureSettings();
  const [visibleAreas, setVisibleAreas] = useState<PortalArea[]>(PORTAL_AREAS.map((area) => area.id));
  const [visibleQualifications, setVisibleQualifications] = useState<string[]>([]);

  useEffect(() => {
    if (!settings) return;
    const qualificationNames = settings.staffQualificationNames?.length
      ? settings.staffQualificationNames
      : DEFAULT_QUALIFICATIONS;
    setVisibleAreas((settings.schoolPortalVisibleTabs as PortalArea[] | undefined) ?? PORTAL_AREAS.map((area) => area.id));
    setVisibleQualifications(
      (settings.schoolPortalVisibleQualificationNames ?? qualificationNames)
        .filter((name) => qualificationNames.includes(name)),
    );
  }, [settings]);

  if (!isFullAccess) {
    return (
      <div className="max-w-2xl p-6">
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
          <ShieldAlert className="h-5 w-5" />
          <p className="text-sm font-medium">These settings are restricted to Admin and Educational Leader users.</p>
        </div>
      </div>
    );
  }

  const qualificationNames = settings?.staffQualificationNames?.length
    ? settings.staffQualificationNames
    : DEFAULT_QUALIFICATIONS;

  function toggleArea(area: PortalArea, visible: boolean) {
    setVisibleAreas((current) => visible
      ? [...current, area].filter((value, index, all) => all.indexOf(value) === index)
      : current.filter((value) => value !== area));
  }

  function toggleQualification(name: string, visible: boolean) {
    setVisibleQualifications((current) => visible
      ? [...current, name]
      : current.filter((value) => value !== name));
  }

  function save() {
    updateSettings.mutate({
      data: {
        schoolPortalVisibleTabs: visibleAreas,
        schoolPortalVisibleQualificationNames: visibleQualifications,
      },
    }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
        toast({ title: "School Portal settings saved" });
      },
      onError: () => toast({ title: "Unable to save School Portal settings", variant: "destructive" }),
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings"><Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button></Link>
        <School className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">School Portal Settings</h1>
          <p className="text-sm text-muted-foreground">Control what school accounts can view.</p>
        </div>
      </div>

      {PORTAL_AREAS.map((area) => (
        <Card key={area.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{area.label}</CardTitle>
                <CardDescription>{area.description}</CardDescription>
              </div>
              <Switch
                aria-label={`Show ${area.label} in the School Portal`}
                checked={visibleAreas.includes(area.id)}
                onCheckedChange={(checked) => toggleArea(area.id, checked)}
              />
            </div>
          </CardHeader>
          {area.id === "staff" && (
            <CardContent className="border-t pt-6">
              <div className="mb-4 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Visible staff qualifications</p>
                  <p className="text-xs text-muted-foreground">Untick a qualification to remove all records of that type from the school's view.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {qualificationNames.map((name) => (
                  <label key={name} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <Checkbox
                      checked={visibleQualifications.includes(name)}
                      onCheckedChange={(checked) => toggleQualification(name, checked === true)}
                    />
                    <span className="leading-5">{name}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} disabled={isLoading || updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}