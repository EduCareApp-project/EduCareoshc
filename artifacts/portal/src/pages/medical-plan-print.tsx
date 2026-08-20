import { useEffect } from "react";
import { Redirect, useSearch } from "wouter";
import { Printer } from "lucide-react";
import {
  getGetChildMedicalPlansPrintQueryKey,
  useGetChildMedicalPlansPrint,
} from "@workspace/api-client-react";
import { fmtMelb } from "@/lib/timezone";

interface RiskCondition {
  id: string;
  allergyCondition: string;
  possibleRisks: string;
  preventionStrategies: string;
  emergencySteps: string;
}

interface MedicalRiskPlanData {
  planLastChecked: string;
  planSignedBy: string;
  conditions: RiskCondition[];
}

interface CommEntry {
  id: string;
  date: string;
  action: string;
  educatorSignature: string;
  guardianAcknowledgedAt?: string;
}

interface CommunicationPlanData {
  grade: string;
  medicalCondition: string;
  medicationLocation: string;
  infoProvided: string;
  staffAwareness: string;
  parentsInformed: string;
  emergencyProcedures: string;
  riskMinimisation: string;
  communications: CommEntry[];
}

const EMPTY_RISK_PLAN: MedicalRiskPlanData = {
  planLastChecked: "",
  planSignedBy: "",
  conditions: [],
};

const EMPTY_COMMUNICATION_PLAN: CommunicationPlanData = {
  grade: "",
  medicalCondition: "",
  medicationLocation: "",
  infoProvided: "",
  staffAwareness: "",
  parentsInformed: "",
  emergencyProcedures: "",
  riskMinimisation: "",
  communications: [],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normaliseRiskPlan(value: unknown): MedicalRiskPlanData {
  const plan = asRecord(value);
  if (!plan) return EMPTY_RISK_PLAN;

  return {
    planLastChecked: asText(plan.planLastChecked),
    planSignedBy: asText(plan.planSignedBy),
    conditions: Array.isArray(plan.conditions)
      ? plan.conditions.flatMap((condition) => {
          const item = asRecord(condition);
          return item
            ? [{
                id: asText(item.id),
                allergyCondition: asText(item.allergyCondition),
                possibleRisks: asText(item.possibleRisks),
                preventionStrategies: asText(item.preventionStrategies),
                emergencySteps: asText(item.emergencySteps),
              }]
            : [];
        })
      : [],
  };
}

function normaliseCommunicationPlan(value: unknown): CommunicationPlanData {
  const plan = asRecord(value);
  if (!plan) return EMPTY_COMMUNICATION_PLAN;

  return {
    grade: asText(plan.grade),
    medicalCondition: asText(plan.medicalCondition),
    medicationLocation: asText(plan.medicationLocation),
    infoProvided: asText(plan.infoProvided),
    staffAwareness: asText(plan.staffAwareness),
    parentsInformed: asText(plan.parentsInformed),
    emergencyProcedures: asText(plan.emergencyProcedures),
    riskMinimisation: asText(plan.riskMinimisation),
    communications: Array.isArray(plan.communications)
      ? plan.communications.flatMap((entry) => {
          const item = asRecord(entry);
          return item
            ? [{
                id: asText(item.id),
                date: asText(item.date),
                action: asText(item.action),
                educatorSignature: asText(item.educatorSignature),
                guardianAcknowledgedAt: asText(item.guardianAcknowledgedAt) || undefined,
              }]
            : [];
        })
      : [],
  };
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PrintEmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500 italic">{children}</p>;
}

export default function MedicalPlanPrint() {
  const search = useSearch();
  const childId = Number(new URLSearchParams(search).get("childId"));
  const { data: child, isLoading, isError } = useGetChildMedicalPlansPrint(
    Number.isInteger(childId) && childId > 0 ? childId : 0,
    {
      query: {
        queryKey: getGetChildMedicalPlansPrintQueryKey(childId),
        enabled: Number.isInteger(childId) && childId > 0,
      },
    },
  );

  useEffect(() => {
    if (!child) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [child]);

  if (!Number.isInteger(childId) || childId <= 0) {
    return <Redirect to="/children" />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <Printer className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">Preparing medical plans for printing…</p>
        </div>
      </div>
    );
  }

  if (isError || !child) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-destructive">Could not load this child’s medical plans.</p>
      </div>
    );
  }

  const riskPlan = normaliseRiskPlan(child.medicalRiskPlan);
  const communicationPlan = normaliseCommunicationPlan(child.communicationPlan);
  const communicationSections = [
    { label: "What information has been provided about the medical condition?", value: communicationPlan.infoProvided },
    { label: "How will staff be made aware of the condition?", value: communicationPlan.staffAwareness },
    { label: "How will we keep parents informed?", value: communicationPlan.parentsInformed },
    { label: "How will staff know what to do in an emergency?", value: communicationPlan.emergencyProcedures },
    { label: "How will we minimise the risk?", value: communicationPlan.riskMinimisation },
  ];

  return (
    <>
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>

      <div className="print:hidden fixed top-0 inset-x-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/educare-hands.png" alt="EduCare" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-sm font-semibold">Medical Plans</p>
            <p className="text-xs text-muted-foreground">{child.firstName} {child.lastName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-[#1b5e20] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#144817]"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      <main className="mx-auto max-w-[1400px] px-6 pb-8 pt-20 print:max-w-none print:px-0 print:pt-0">
        <div
          role="banner"
          className="mb-6 flex items-start justify-between border-b-2 border-[#1b5e20] pb-4"
        >
          <div className="flex items-center gap-4">
            <img src="/educare-hands.png" alt="EduCare" className="h-14 w-14 object-contain" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1b5e20]">EduCare</p>
              <h1 className="text-2xl font-bold text-slate-900">Medical Plans</h1>
              <p className="mt-1 text-sm text-slate-600">
                {child.firstName} {child.lastName}
              </p>
            </div>
          </div>
          <p className="text-right text-xs text-slate-500">
            Printed {fmtMelb(new Date(), "dd/MM/yyyy")}
          </p>
        </div>

        <section className="mb-7 break-inside-avoid">
          <div className="mb-3 flex items-center gap-2 border-b border-red-300 pb-2">
            <div className="h-3 w-3 rounded-full bg-red-600" />
            <h2 className="text-lg font-bold text-slate-900">Individual Medical Risk Minimisation Plan</h2>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan Last Checked</p>
              <p className="mt-0.5 text-slate-900">{formatDate(riskPlan.planLastChecked)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed By</p>
              <p className="mt-0.5 text-slate-900">{riskPlan.planSignedBy || "—"}</p>
            </div>
          </div>

          {riskPlan.conditions.length === 0 ? (
            <PrintEmptyState>No risk plan details have been recorded.</PrintEmptyState>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-red-100 text-red-950">
                  {["Allergy / Condition", "Possible Risks / Dangers", "Risk Management Strategies", "Emergency Steps"].map((heading) => (
                    <th key={heading} className="border border-red-300 px-3 py-2 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riskPlan.conditions.map((condition) => (
                  <tr key={condition.id} className="align-top">
                    <td className="border border-slate-300 bg-red-50 px-3 py-2 font-medium whitespace-pre-wrap">{condition.allergyCondition || "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap">{condition.possibleRisks || "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap">{condition.preventionStrategies || "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap">{condition.emergencySteps || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="break-inside-avoid">
          <div className="mb-3 flex items-center gap-2 border-b border-blue-300 pb-2">
            <div className="h-3 w-3 rounded-full bg-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Medical Condition Communication Plan</h2>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grade / Year</p>
              <p className="mt-0.5 text-slate-900">{communicationPlan.grade || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medical Condition</p>
              <p className="mt-0.5 text-slate-900">{communicationPlan.medicalCondition || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location of Medication</p>
              <p className="mt-0.5 text-slate-900">{communicationPlan.medicationLocation || "—"}</p>
            </div>
          </div>

          {communicationSections.some((section) => section.value) && (
            <div className="mb-5 grid grid-cols-2 gap-3">
              {communicationSections.filter((section) => section.value).map((section) => (
                <div key={section.label} className="break-inside-avoid border border-orange-300 bg-orange-50 p-3">
                  <p className="mb-1 text-xs font-bold text-slate-800">{section.label}</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-900">{section.value}</p>
                </div>
              ))}
            </div>
          )}

          {communicationPlan.communications.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Communication and/or Changes to Medical Condition</h3>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    {["Date", "Action", "Educator Signature", "Guardian Acknowledgement"].map((heading) => (
                      <th key={heading} className="border border-slate-300 px-3 py-2 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {communicationPlan.communications.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="border border-slate-300 px-3 py-2 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap">{entry.action || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2">{entry.educatorSignature || "—"}</td>
                      <td className="border border-slate-300 px-3 py-2">
                        {entry.guardianAcknowledgedAt ? formatDate(entry.guardianAcknowledgedAt.slice(0, 10)) : "Pending"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-7 hidden items-center justify-between border-t border-slate-300 pt-3 text-[10px] text-slate-500 print:flex">
          <span>EduCare — Medical Plans</span>
          <span>Printed {fmtMelb(new Date(), "dd/MM/yyyy 'at' h:mm a")}</span>
        </footer>
      </main>
    </>
  );
}