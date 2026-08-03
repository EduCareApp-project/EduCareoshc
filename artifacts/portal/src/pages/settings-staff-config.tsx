import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, Users, Save, ShieldAlert, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { SYSTEM_ROLES } from "@/hooks/use-staff-roles";
import {
  useGetFeatureSettings,
  getGetFeatureSettingsQueryKey,
  useUpdateFeatureSettings,
} from "@workspace/api-client-react";

const DEFAULT_QUAL_NAMES = [
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

export default function SettingsStaffConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [requireWwcc, setRequireWwcc] = useState(true);
  const [appraisalCycle, setAppraisalCycle] = useState("365");
  const [profilesVisibleToPeers, setProfilesVisibleToPeers] = useState(false);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState("");
  const [qualNames, setQualNames] = useState<string[]>(DEFAULT_QUAL_NAMES);
  const [newQualName, setNewQualName] = useState("");

  useEffect(() => {
    if (!settings) return;
    setRequireWwcc(settings.staffRequireWwcc ?? true);
    setAppraisalCycle(String(settings.staffAppraisalCycleDays ?? 365));
    setProfilesVisibleToPeers(settings.staffProfilesVisibleToPeers ?? false);
    setCustomRoles(settings.staffCustomRoles ?? []);
    setQualNames(settings.staffQualificationNames ?? DEFAULT_QUAL_NAMES);
  }, [settings]);

  function handleAddQualName() {
    const trimmed = newQualName.trim();
    if (!trimmed) return;
    if (qualNames.map((n) => n.toLowerCase()).includes(trimmed.toLowerCase())) {
      toast({ title: "Qualification name already exists", variant: "destructive" });
      return;
    }
    setQualNames((prev) => [...prev, trimmed]);
    setNewQualName("");
  }

  function handleRemoveQualName(name: string) {
    setQualNames((prev) => prev.filter((n) => n !== name));
  }

  function handleAddRole() {
    const trimmed = newRole.trim();
    if (!trimmed) return;
    const existing = [...SYSTEM_ROLES.map((r) => r.value.toLowerCase()), ...customRoles.map((r) => r.toLowerCase())];
    if (existing.includes(trimmed.toLowerCase())) {
      toast({ title: "Role already exists", variant: "destructive" });
      return;
    }
    setCustomRoles((prev) => [...prev, trimmed]);
    setNewRole("");
  }

  function handleRemoveRole(role: string) {
    setCustomRoles((prev) => prev.filter((r) => r !== role));
  }

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          staffRequireWwcc: requireWwcc,
          staffAppraisalCycleDays: parseInt(appraisalCycle) || 365,
          staffProfilesVisibleToPeers: profilesVisibleToPeers,
          staffCustomRoles: customRoles,
          staffQualificationNames: qualNames,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Staff settings saved" });
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
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Staff Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Requirements</CardTitle>
          <CardDescription>Mandatory credentials and checks for all staff members.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Require WWCC for all staff</p>
                <p className="text-xs text-muted-foreground">A Working With Children Check number must be recorded for every staff member.</p>
              </div>
              <Switch checked={requireWwcc} onCheckedChange={setRequireWwcc} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appraisals</CardTitle>
          <CardDescription>Default appraisal schedule and visibility settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Default appraisal cycle</Label>
                <Select value={appraisalCycle} onValueChange={setAppraisalCycle}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">Quarterly (90 days)</SelectItem>
                    <SelectItem value="180">Semi-annual (180 days)</SelectItem>
                    <SelectItem value="365">Annual (365 days)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How often staff appraisals are scheduled by default.</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Staff profiles visible to peers</p>
                  <p className="text-xs text-muted-foreground">Allow educators to view each other's staff profiles and qualifications.</p>
                </div>
                <Switch checked={profilesVisibleToPeers} onCheckedChange={setProfilesVisibleToPeers} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff Roles</CardTitle>
          <CardDescription>
            Define the roles available when creating or editing staff profiles. System roles cannot be removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* System roles — read-only */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">System roles</p>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_ROLES.map((r) => (
                <span
                  key={r.value}
                  className="flex items-center gap-1.5 text-sm bg-muted text-muted-foreground rounded-md px-3 py-1.5 border"
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom roles */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Custom roles</p>
            {customRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground italic mb-3">No custom roles added yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-3">
                {customRoles.map((role) => (
                  <span
                    key={role}
                    className="flex items-center gap-1.5 text-sm bg-primary/10 text-primary rounded-md px-3 py-1.5 border border-primary/20"
                  >
                    {role}
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(role)}
                      className="ml-0.5 text-primary/60 hover:text-destructive transition-colors"
                      aria-label={`Remove ${role}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="e.g. Room Leader"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRole(); } }}
                className="max-w-xs"
              />
              <Button type="button" variant="outline" onClick={handleAddRole} disabled={!newRole.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add Role
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qualification Names</CardTitle>
          <CardDescription>
            The list of qualification types available when adding qualifications to a staff profile.
            These names also drive the compliance tier configuration in Staff Compliance Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-24 bg-muted/30 rounded animate-pulse" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {qualNames.map((name) => (
                  <span
                    key={name}
                    className="flex items-center gap-1.5 text-sm bg-primary/10 text-primary rounded-md px-3 py-1.5 border border-primary/20"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => handleRemoveQualName(name)}
                      className="ml-0.5 text-primary/60 hover:text-destructive transition-colors"
                      aria-label={`Remove ${name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {qualNames.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No qualification names configured.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Anaphylaxis Management"
                  value={newQualName}
                  onChange={(e) => setNewQualName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddQualName(); } }}
                  className="max-w-sm"
                />
                <Button type="button" variant="outline" onClick={handleAddQualName} disabled={!newQualName.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Staff Settings
        </Button>
      </div>
    </div>
  );
}
