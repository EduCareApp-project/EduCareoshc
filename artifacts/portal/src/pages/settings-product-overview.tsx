import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Baby, Users, UserCog, BookOpen, StickyNote, Newspaper,
  Layers, CalendarDays, ShieldCheck, TrendingUp, AlertTriangle, ClipboardX,
  ShieldAlert, FolderOpen, CheckSquare, BarChart2, UserCheck, BookMarked,
  Bell, FileText, GraduationCap, ClipboardList, Award,
} from "lucide-react";

const BRAND = "#1a4d6e";
const BRAND_LIGHT = "#e8f4f8";
const GREEN = "#008a35";

type Feature = {
  icon: React.ElementType;
  name: string;
  description: string;
};

type Section = {
  title: string;
  colour: string;
  features: Feature[];
};

const SECTIONS: Section[] = [
  {
    title: "Dashboard & Overview",
    colour: "#1a4d6e",
    features: [
      { icon: LayoutDashboard, name: "Live Dashboard", description: "Real-time centre metrics — attendance, open incidents, NQS status, recent observations and MTOP outcome usage at a glance." },
      { icon: BarChart2, name: "Service Reports", description: "Roll submissions, incident summaries, compliance snapshots and weekly activity totals presented as printable reports." },
    ],
  },
  {
    title: "Children & Families",
    colour: "#2e7d32",
    features: [
      { icon: Baby, name: "Child Enrolment & Profiles", description: "Full enrolment records with age group, status, linked guardians, medical notes, observations and documents in one profile." },
      { icon: UserCog, name: "Guardian Portal", description: "Families access notices, medication logs, authorised pickups and medical information through a secure dedicated portal." },
      { icon: ClipboardX, name: "Condition Reports", description: "Record and track children's health conditions on arrival, with escalation prompts and guardian notification workflows." },
      { icon: ClipboardList, name: "Medication Logs", description: "Document medication administration with dosage, time, staff signature and parent acknowledgment." },
    ],
  },
  {
    title: "Staff Management",
    colour: "#6a1e6e",
    features: [
      { icon: Users, name: "Staff Profiles", description: "Manage educator profiles with roles, contact details, site assignments and document storage." },
      { icon: GraduationCap, name: "Qualifications & WWCC", description: "Track qualifications, expiry dates and Working With Children Checks with automated compliance alerts." },
      { icon: Award, name: "Staff Appraisals", description: "Structured three-stage appraisal process with goal setting, peer feedback and sign-off workflows." },
      { icon: UserCheck, name: "Staff Compliance Reports", description: "At-a-glance compliance dashboard showing qualification gaps, expiring documents and WWCC status across all staff." },
    ],
  },
  {
    title: "Learning & Programming",
    colour: "#c56a00",
    features: [
      { icon: BookOpen, name: "Observations", description: "Document children's learning linked to MTOP outcomes and current programs, with photo support and comment threads." },
      { icon: Layers, name: "Weekly Plans", description: "Plan educational experiences across the week with MTOP outcome tagging, age group targeting and printable PDF output." },
      { icon: StickyNote, name: "Jottings", description: "Quick anecdotal notes attached to individual children, supporting continuous documentation between formal observations." },
      { icon: Newspaper, name: "Posts", description: "Share learning stories, notices and updates with families — with site visibility controls and guardian read-receipts." },
      { icon: BookMarked, name: "Learning Compliance", description: "Compliance report tracking observations, jottings and posts by site and period, mapped against MTOP outcomes." },
    ],
  },
  {
    title: "NQS & Quality Improvement",
    colour: "#1a4d6e",
    features: [
      { icon: ShieldCheck, name: "NQS Compliance (7 Areas)", description: "Track all seven National Quality Standard areas with current status, review notes and last-reviewed timestamps." },
      { icon: TrendingUp, name: "Quality Improvement Plan", description: "Per-site QIP with improvement items, goals, strategies, success measures and progress notes linked to NQS elements." },
      { icon: FileText, name: "Public QIP Page", description: "Auto-generated public-facing QIP page for each site — always in sync with internal records, no manual export needed." },
    ],
  },
  {
    title: "Safety & Compliance",
    colour: "#b71c1c",
    features: [
      { icon: AlertTriangle, name: "Incident Log", description: "Record workplace and child incidents with categories, severity, witnesses and follow-up actions — meets regulatory requirements." },
      { icon: ShieldAlert, name: "Safety Evacuations", description: "Log evacuation drills with outcomes, duration and staff sign-off, maintaining a compliant drill history." },
      { icon: FolderOpen, name: "Policies & Procedures", description: "Centralised policy library with version control, staff acknowledgment tracking and parent-accessible document portal." },
      { icon: CheckSquare, name: "Checklists", description: "Daily opening, closing and operational checklists with completion tracking, photo evidence and overdue alerts." },
      { icon: CalendarDays, name: "Calendar", description: "Service-wide calendar for events, programming milestones, compliance deadlines and staff meetings." },
    ],
  },
  {
    title: "Notifications & Communication",
    colour: "#00695c",
    features: [
      { icon: Bell, name: "In-App Notifications", description: "Event-driven notifications for incidents, expiring documents, overdue checklists and new posts — configurable per role." },
      { icon: UserCog, name: "Email Notifications", description: "Transactional emails for password resets, new posts and compliance alerts delivered via branded templates." },
    ],
  },
];

const MTOP = [
  "1. Strong Sense of Identity",
  "2. Connected to Their World",
  "3. Strong Sense of Wellbeing",
  "4. Confident & Involved Learners",
  "5. Effective Communicators",
];

export default function SettingsProductOverview() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Overview</h1>
          <p className="text-muted-foreground mt-1">Full feature reference for EduCare — print or save as PDF.</p>
        </div>
        <Button
          onClick={() => window.print()}
          className="print:hidden gap-2"
          style={{ backgroundColor: BRAND }}
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm 12mm; }
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* ── Flyer content ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:shadow-none print:border-0 print:rounded-none">

        {/* Hero header */}
        <div
          className="px-10 py-10 print:py-8"
          style={{ background: `linear-gradient(135deg, #1a4731 0%, #2d6a4f 55%, ${BRAND} 100%)` }}
        >
          <div className="flex items-center gap-5 mb-6">
            <img src="/educare-logo.png" alt="EduCare" className="h-16 w-16 object-contain bg-white/10 rounded-xl p-2" />
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">EduCare</h1>
              <p className="text-white/80 text-sm font-medium mt-0.5">
                Education &amp; Care Management Software
              </p>
            </div>
          </div>
          <p className="text-white/90 text-base leading-relaxed max-w-2xl">
            Purpose-built for Australian OSHC and childcare services. EduCare brings children,
            families, staff, compliance and documentation into one integrated platform — aligned
            to the National Law and the <em>My Time, Our Place</em> framework.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Australian National Law", "MTOP Framework", "NQS 7 Quality Areas", "Multi-site ready", "Role-based access"].map((tag) => (
              <span key={tag} className="text-xs font-medium px-3 py-1 rounded-full bg-white/20 text-white border border-white/30">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* MTOP strip */}
        <div className="px-10 py-4 border-b" style={{ backgroundColor: "#f0f9f4" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: GREEN }}>
            My Time, Our Place — 5 Learning Outcomes
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {MTOP.map((o) => (
              <span key={o} className="text-sm text-gray-700">{o}</span>
            ))}
          </div>
        </div>

        {/* Feature sections */}
        <div className="px-10 py-8 space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-1 w-6 rounded-full" style={{ backgroundColor: section.colour }} />
                <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: section.colour }}>
                  {section.title}
                </h2>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.features.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.name}
                      className="flex gap-3 p-3.5 rounded-lg border border-gray-100"
                      style={{ backgroundColor: "#fafafa" }}
                    >
                      <div
                        className="shrink-0 mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${section.colour}18` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: section.colour }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{f.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-10 py-6 flex items-center justify-between gap-4"
          style={{ backgroundColor: BRAND_LIGHT, borderTop: `2px solid ${BRAND}` }}
        >
          <div className="flex items-center gap-3">
            <img src="/educare-logo.png" alt="EduCare" className="h-8 w-8 object-contain opacity-70" />
            <div>
              <p className="text-sm font-bold" style={{ color: BRAND }}>EduCare</p>
              <p className="text-xs text-gray-500">Education &amp; Care Management Software</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-right">
            This document summarises the features of EduCare as currently deployed.
          </p>
        </div>

      </div>
    </div>
  );
}
