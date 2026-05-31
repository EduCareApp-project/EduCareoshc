import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, ClipboardList, HeartPulse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface RiskCondition { id: string; allergyCondition: string; possibleRisks: string; preventionStrategies: string; emergencySteps: string; }
interface MedicalRiskPlanData { planLastChecked: string; planSignedBy: string; conditions: RiskCondition[]; }
interface CommEntry { id: string; date: string; action: string; educatorSignature: string; guardianAcknowledgedAt?: string; }
interface CommunicationPlanData { grade: string; medicalCondition: string; medicationLocation: string; infoProvided: string; staffAwareness: string; parentsInformed: string; emergencyProcedures: string; riskMinimisation: string; communications: CommEntry[]; }

type Child = {
  id: number;
  firstName: string;
  lastName: string;
  hasMedicalCondition?: boolean;
  medicalRiskPlan?: unknown;
  communicationPlan?: unknown;
};

function fmtDate(iso: string) {
  try { return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
}

function RiskPlanView({ plan }: { plan: MedicalRiskPlanData }) {
  const hasMeta = plan.planLastChecked || plan.planSignedBy;
  return (
    <div className="space-y-4">
      {hasMeta && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {plan.planLastChecked && <div><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Plan Last Checked</p><p>{fmtDate(plan.planLastChecked)}</p></div>}
          {plan.planSignedBy && <div><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Signed By</p><p>{plan.planSignedBy}</p></div>}
        </div>
      )}
      {plan.conditions.length === 0 && <p className="text-sm text-muted-foreground italic">No conditions recorded yet.</p>}
      {plan.conditions.map((c) => (
        <div key={c.id} className="border-2 border-gray-400 rounded-lg overflow-hidden text-sm">
          <div className="bg-red-100 px-4 py-2 border-b-2 border-gray-400">
            <p className="font-semibold text-red-800">{c.allergyCondition || "Condition"}</p>
          </div>
          <div className="grid grid-cols-3 divide-x-2 divide-gray-400">
            <div className="p-4 bg-red-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">Possible Risks / Dangers</p>
              <p className="whitespace-pre-wrap">{c.possibleRisks || <span className="text-muted-foreground italic">—</span>}</p>
            </div>
            <div className="p-4 bg-red-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">Risk Management Strategies</p>
              <p className="whitespace-pre-wrap">{c.preventionStrategies || <span className="text-muted-foreground italic">—</span>}</p>
            </div>
            <div className="p-4 bg-red-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">Emergency Steps</p>
              <p className="whitespace-pre-wrap">{c.emergencySteps || <span className="text-muted-foreground italic">—</span>}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const COMM_SECTIONS: { key: keyof CommunicationPlanData; label: string }[] = [
  { key: "infoProvided", label: "What information has been provided about the medical condition?" },
  { key: "staffAwareness", label: "How will staff be made aware of the condition?" },
  { key: "parentsInformed", label: "How will we keep parents informed?" },
  { key: "emergencyProcedures", label: "How will staff know what to do in an emergency?" },
  { key: "riskMinimisation", label: "How will we minimise the risk?" },
];

function CommPlanView({ plan, childId, onAcknowledge }: { plan: CommunicationPlanData; childId: number; onAcknowledge: (childId: number, entryId: string) => void; acknowledging: boolean }) {
  const hasMeta = plan.grade || plan.medicalCondition || plan.medicationLocation;
  const sections = COMM_SECTIONS.filter((s) => (plan[s.key] as string));
  return (
    <div className="space-y-4 text-sm">
      {hasMeta && (
        <div className="grid sm:grid-cols-3 gap-3">
          {plan.grade && <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Grade / Year</p><p>{plan.grade}</p></div>}
          {plan.medicalCondition && <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Medical Condition</p><p>{plan.medicalCondition}</p></div>}
          {plan.medicationLocation && <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Location of Medication</p><p>{plan.medicationLocation}</p></div>}
        </div>
      )}
      {sections.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {sections.map((s) => (
            <div key={s.key} className="border-2 border-orange-300 rounded-lg p-3 bg-orange-50">
              <p className="text-xs font-bold mb-1">{s.label}</p>
              <p className="whitespace-pre-wrap">{plan[s.key] as string}</p>
            </div>
          ))}
        </div>
      )}
      {plan.communications.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Communication and/or Changes to Medical Condition</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-2 border-gray-400 rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  {["Date", "Action", "Educator Signature", "Guardian Acknowledgement"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.communications.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{e.date ? fmtDate(e.date) : ""}</td>
                    <td className="px-3 py-2">{e.action}</td>
                    <td className="px-3 py-2">{e.educatorSignature}</td>
                    <td className="px-3 py-2">
                      {e.guardianAcknowledgedAt ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                          ✓ {fmtDate(e.guardianAcknowledgedAt)}
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAcknowledge(childId, e.id)}>
                          Acknowledge
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuardianMedical() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: children, isLoading } = useQuery<Child[]>({
    queryKey: ["/api/auth/my-children"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-children");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ childId, entryId }: { childId: number; entryId: string }) => {
      const res = await fetch("/api/auth/acknowledge-comm-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, entryId }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-children"] });
      toast({ title: "Acknowledged" });
    },
    onError: () => toast({ title: "Failed to acknowledge", variant: "destructive" }),
  });

  const medicalChildren = (children ?? []).filter((c) => c.hasMedicalCondition);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HeartPulse className="h-6 w-6 text-muted-foreground" />
          Medical Plans
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your child's medical risk minimisation and communication plans.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
      ) : medicalChildren.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <HeartPulse className="h-10 w-10 mb-3 opacity-25" />
            <p className="font-medium">No medical plans on file</p>
            <p className="text-sm mt-1">If your child has a medical condition, contact the centre to have a plan recorded.</p>
          </CardContent>
        </Card>
      ) : (
        medicalChildren.map((child) => {
          const riskPlan = (child.medicalRiskPlan as MedicalRiskPlanData | null) ?? { planLastChecked: "", planSignedBy: "", conditions: [] };
          const commPlan = (child.communicationPlan as CommunicationPlanData | null) ?? { grade: "", medicalCondition: "", medicationLocation: "", infoProvided: "", staffAwareness: "", parentsInformed: "", emergencyProcedures: "", riskMinimisation: "", communications: [] };
          return (
            <div key={child.id} className="space-y-4">
              <h2 className="text-lg font-semibold">{child.firstName} {child.lastName}</h2>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                    Individual Medical Risk Minimisation Plan
                  </CardTitle>
                </CardHeader>
                <CardContent><RiskPlanView plan={riskPlan} /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-blue-600" />
                    Medical Condition Communication Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CommPlanView
                    plan={commPlan}
                    childId={child.id}
                    onAcknowledge={(childId, entryId) => acknowledgeMutation.mutate({ childId, entryId })}
                    acknowledging={acknowledgeMutation.isPending}
                  />
                </CardContent>
              </Card>
            </div>
          );
        })
      )}
    </div>
  );
}
