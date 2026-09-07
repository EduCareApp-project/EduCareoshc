import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Printer } from "lucide-react";
import { RichTextView } from "@/components/rich-text-editor";

// ── Shared types ──────────────────────────────────────────────────────────────
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
export type RowKey =
  | "experiencesThemes"
  | "active"
  | "creative"
  | "construction"
  | "wellbeing"
  | "imaginative"
  | "spontaneousChoice";

export const ROW_LABELS: { key: RowKey; label: string }[] = [
  { key: "experiencesThemes", label: "Experiences / Themes" },
  { key: "active",            label: "Active" },
  { key: "creative",         label: "Creative" },
  { key: "construction",     label: "Construction" },
  { key: "wellbeing",        label: "Wellbeing" },
  { key: "imaginative",      label: "Imaginative" },
  { key: "spontaneousChoice",label: "Spontaneous Choice" },
];

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
export const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export type WeeklyPlanGrid = Record<RowKey, Record<DayKey, string>>;
export type CellOutcomes = Record<string, string[]>;

export type ExistingPlan = {
  id: number;
  title?: string | null;
  weeklyPlanData?: any;
  siteId?: number | null;
  stage?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function emptyGrid(): WeeklyPlanGrid {
  const grid: Partial<WeeklyPlanGrid> = {};
  for (const { key } of ROW_LABELS) {
    grid[key] = { mon: "", tue: "", wed: "", thu: "", fri: "" };
  }
  return grid as WeeklyPlanGrid;
}

export function initGridFromPlan(plan: ExistingPlan): WeeklyPlanGrid {
  const data = plan.weeklyPlanData ?? {};
  const g = emptyGrid();
  for (const key of Object.keys(g) as RowKey[]) {
    if (data[key] && typeof data[key] === "object") {
      g[key] = { ...g[key], ...data[key] };
    }
  }
  return g;
}

export const MTOP_OUTCOMES = [
  {
    id: 1,
    label: "Outcome 1",
    title: "Children have a strong sense of identity",
    dot: "bg-blue-500",
    bubble: "bg-blue-100 text-blue-800 border-blue-300",
    sub: [
      { id: "1.1", desc: "Children feel safe, secure and supported" },
      { id: "1.2", desc: "Children develop their autonomy, inter-dependence, resilience and sense of agency" },
      { id: "1.3", desc: "Children develop knowledgeable and confident self-identities" },
      { id: "1.4", desc: "Children learn to interact in relation to others with care, empathy and respect" },
    ],
  },
  {
    id: 2,
    label: "Outcome 2",
    title: "Children are connected with and contribute to their world",
    dot: "bg-green-500",
    bubble: "bg-green-100 text-green-800 border-green-300",
    sub: [
      { id: "2.1", desc: "Children develop a sense of belonging to groups and communities and an understanding of reciprocal rights and responsibilities" },
      { id: "2.2", desc: "Children respond to diversity with respect" },
      { id: "2.3", desc: "Children become aware of fairness" },
      { id: "2.4", desc: "Children become socially responsible and show respect for the environment" },
    ],
  },
  {
    id: 3,
    label: "Outcome 3",
    title: "Children have a strong sense of wellbeing",
    dot: "bg-orange-500",
    bubble: "bg-orange-100 text-orange-800 border-orange-300",
    sub: [
      { id: "3.1", desc: "Children become strong in their social, emotional and mental health" },
      { id: "3.2", desc: "Children take increasing responsibility for their own health and physical wellbeing" },
      { id: "3.3", desc: "Children are aware of and develop strategies to support their physical and emotional wellbeing" },
    ],
  },
  {
    id: 4,
    label: "Outcome 4",
    title: "Children are confident and involved learners",
    dot: "bg-purple-500",
    bubble: "bg-purple-100 text-purple-800 border-purple-300",
    sub: [
      { id: "4.1", desc: "Children develop dispositions for learning such as curiosity, cooperation, confidence, creativity, commitment, enthusiasm, persistence, imagination and reflexivity" },
      { id: "4.2", desc: "Children use a range of skills and processes such as problem solving, inquiry, experimentation, hypothesising, researching and investigating" },
      { id: "4.3", desc: "Children transfer and adapt what they have learned from one context to another" },
      { id: "4.4", desc: "Children resource their own learning through connecting with people, place, technologies and natural and processed materials" },
    ],
  },
  {
    id: 5,
    label: "Outcome 5",
    title: "Children are effective communicators",
    dot: "bg-rose-500",
    bubble: "bg-rose-100 text-rose-800 border-rose-300",
    sub: [
      { id: "5.1", desc: "Children interact verbally and non-verbally with others for a range of purposes" },
      { id: "5.2", desc: "Children engage with a range of texts and make meaning from these texts" },
      { id: "5.3", desc: "Children express ideas and make meaning using a range of media" },
      { id: "5.4", desc: "Children begin to understand how symbols and pattern systems work" },
      { id: "5.5", desc: "Children use information and communication technologies to access information, investigate ideas and represent their thinking" },
    ],
  },
];

export function bubbleClassForSub(subId: string) {
  const parentId = parseInt(subId.split(".")[0]);
  return MTOP_OUTCOMES.find((o) => o.id === parentId)?.bubble ?? "bg-slate-100 text-slate-700 border-slate-300";
}

export function dotClassForSub(subId: string) {
  const parentId = parseInt(subId.split(".")[0]);
  return MTOP_OUTCOMES.find((o) => o.id === parentId)?.dot ?? "bg-slate-400";
}

// ── Read-only plan view dialog ────────────────────────────────────────────────
export function ReadOnlyPlanView({
  plan,
  siteName,
  onClose,
}: {
  plan: ExistingPlan;
  siteName?: string;
  onClose: () => void;
}) {
  const grid = initGridFromPlan(plan);
  const cellOutcomes: CellOutcomes = (plan.weeklyPlanData as any)?.cellOutcomes ?? {};

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        onWheel={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle>{plan.title ?? "Weekly Plan"}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              {siteName && (
                <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 text-xs font-medium">
                  {siteName}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 text-xs font-medium gap-1">
                <Send className="h-3 w-3" /> Published
              </span>
              <button
                onClick={() => window.open(`/planning/print?id=${plan.id}`, "_blank")}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
              >
                <Printer className="h-3 w-3" />
                Print PDF
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#1a4d6e] text-white">
                <th className="border border-blue-900 px-3 py-2 text-left font-semibold w-36" />
                {DAY_LABELS.map((d) => (
                  <th key={d} className="border border-blue-900 px-2 py-2 text-center font-semibold">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_LABELS.map(({ key, label }, ri) => (
                <tr key={key} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700 whitespace-nowrap align-top">
                    {label}
                  </td>
                  {DAY_KEYS.map((day) => {
                    const ck = `${key}-${day}`;
                    const outcomes = cellOutcomes[ck] ?? [];
                    const text = grid[key][day];
                    return (
                      <td key={day} className="border border-slate-200 px-2 py-2 align-top min-w-[100px]">
                        {text && (
                          /<[a-z][\s\S]*>/i.test(text)
                            ? <RichTextView html={text} className="text-slate-800 mb-1 leading-snug [&_p]:my-0" />
                            : <p className="whitespace-pre-wrap text-slate-800 mb-1 leading-snug">{text}</p>
                        )}
                        {outcomes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {outcomes.map((subId) => (
                              <span
                                key={subId}
                                className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${bubbleClassForSub(subId)}`}
                              >
                                {subId}
                              </span>
                            ))}
                          </div>
                        )}
                        {!text && outcomes.length === 0 && (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
