import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, UserCheck, Save, ShieldAlert, ShieldX,
  CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
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

const DEFAULT_CANNOT_WORK = ["WWCC", "CPR Renewal", "First Aid"];
const DEFAULT_RP_QUALS = [
  "Child Safety - Mandatory Reporting and Other Obligations",
  "CPR Renewal",
  "Education Qualifications",
  "First Aid",
  "Food Safety",
  "History & Compliance",
  "Responsible Person Declaration",
  "Risk Management (DET)",
  "Staff Details (DET)",
  "WWCC",
];
const DEFAULT_EDUCATOR_QUALS = [
  "Staff Details (DET)",
  "WWCC",
  "Child Safety - Mandatory Reporting and Other Obligations",
];

const STATUS_REFERENCE = [
  {
    label: "Cannot Work",
    badge: "bg-red-100 text-red-800 border border-red-200",
    Icon: ShieldX,
    iconClass: "text-red-500",
    description:
      "One or more Cannot Work qualifications has expired. The staff member cannot legally work until the qualification is renewed.",
  },
  {
    label: "Responsible Person",
    badge: "bg-green-100 text-green-800 border border-green-200",
    Icon: CheckCircle2,
    iconClass: "text-green-600",
    description:
      "All Responsible Person qualifications are current. The staff member can be designated as the Responsible Person on duty.",
  },
  {
    label: "Educator",
    badge: "bg-blue-100 text-blue-800 border border-blue-200",
    Icon: UserCheck,
    iconClass: "text-blue-500",
    description:
      "All core Educator qualifications are current but not all Responsible Person qualifications are held.",
  },
  {
    label: "Incomplete",
    badge: "bg-amber-100 text-amber-800 border border-amber-200",
    Icon: AlertTriangle,
    iconClass: "text-amber-500",
    description:
      "One or more core Educator qualifications is missing or has not yet been recorded.",
  },
];

function TierSection({
  title,
  description,
  qualNames,
  selected,
  onChange,
}: {
  title: string;
  description: string;
  qualNames: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(name: string) {
    onChange(
      selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 pl-1">
        {qualNames.map((name) => (
          <label key={name} className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              checked={selected.includes(name)}
              onCheckedChange={() => toggle(name)}
              id={`tier-${title}-${name}`}
            />
            <span className="text-sm group-hover:text-primary transition-colors">{name}</span>
          </label>
        ))}
        {qualNames.length === 0 && (
          <p className="text-sm text-muted-foreground italic col-span-2">
            No qualification names configured — add them in Staff Settings first.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SettingsStaffComplianceConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [warnDays, setWarnDays] = useState("60");
  const [suspendOnExpiry, setSuspendOnExpiry] = useState(false);
  const [cannotWorkQuals, setCannotWorkQuals] = useState<string[]>(DEFAULT_CANNOT_WORK);
  const [rpQuals, setRpQuals] = useState<string[]>(DEFAULT_RP_QUALS);
  const [educatorQuals, setEducatorQuals] = useState<string[]>(DEFAULT_EDUCATOR_QUALS);

  useEffect(() => {
    if (!settings) return;
    setWarnDays(String(settings.staffComplianceWarnDays ?? 60));
    setSuspendOnExpiry(settings.staffComplianceSuspendOnExpiry ?? false);
    setCannotWorkQuals(settings.staffCannotWorkQuals ?? DEFAULT_CANNOT_WORK);
    setRpQuals(settings.staffResponsiblePersonQuals ?? DEFAULT_RP_QUALS);
    setEducatorQuals(settings.staffEducatorQuals ?? DEFAULT_EDUCATOR_QUALS);
  }, [settings]);

  const qualNames = settings?.staffQualificationNames ?? DEFAULT_QUAL_NAMES;

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          staffComplianceWarnDays: parseInt(warnDays) || 60,
          staffComplianceSuspendOnExpiry: suspendOnExpiry,
          staffCannotWorkQuals: cannotWorkQuals,
          staffResponsiblePersonQuals: rpQuals,
          staffEducatorQuals: educatorQuals,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Staff Compliance settings saved" });
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
          <UserCheck className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Staff Compliance Settings</h1>
        </div>
      </div>

      {/* Status Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Compliance Status Reference
          </CardTitle>
          <CardDescription>
            How each status is determined based on the qualification tier configuration below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {STATUS_REFERENCE.map(({ label, badge, Icon, iconClass, description }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconClass}`} />
              <div className="space-y-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>
                  {label}
                </span>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Compliance Tiers */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Tiers</CardTitle>
          <CardDescription>
            Assign qualification names to each tier. Tier membership updates automatically as
            qualification names are added in Staff Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted/30 rounded animate-pulse" />)}
            </div>
          ) : (
            <>
              <TierSection
                title="Cannot Work Qualifications"
                description="If any of these qualifications expires, the staff member is immediately flagged as Cannot Work."
                qualNames={qualNames}
                selected={cannotWorkQuals}
                onChange={setCannotWorkQuals}
              />
              <Separator />
              <TierSection
                title="Responsible Person Qualifications"
                description="All of these qualifications must be current for a staff member to reach Responsible Person status."
                qualNames={qualNames}
                selected={rpQuals}
                onChange={setRpQuals}
              />
              <Separator />
              <TierSection
                title="Educator Core Qualifications"
                description="All of these qualifications must be current for a staff member to reach Educator status. This is typically a subset of Responsible Person."
                qualNames={qualNames}
                selected={educatorQuals}
                onChange={setEducatorQuals}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Expiry Warnings */}
      <Card>
        <CardHeader>
          <CardTitle>Expiry Warnings</CardTitle>
          <CardDescription>How early to alert coordinators of upcoming qualification expiries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="warn-days">Warning lead time</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="warn-days"
                    type="number"
                    min={7}
                    max={180}
                    value={warnDays}
                    onChange={(e) => setWarnDays(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">days before expiry</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Coordinators receive a compliance alert when a qualification is within this many days of expiry.
                </p>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Suspend portal access on expiry</p>
                  <p className="text-xs text-muted-foreground">
                    Staff whose required qualifications have expired are blocked from logging in until renewed.
                  </p>
                </div>
                <Switch checked={suspendOnExpiry} onCheckedChange={setSuspendOnExpiry} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Save Staff Compliance Settings
        </Button>
      </div>
    </div>
  );
}
