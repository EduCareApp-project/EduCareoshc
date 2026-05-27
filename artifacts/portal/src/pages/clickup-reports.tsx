import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Minus, ExternalLink, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { Redirect } from "wouter";

interface ClickUpReport {
  id: string;
  date: string;
  status: string;
  service: string | null;
  staffOnTime: string | null;
  staffUniform: string | null;
  plannedProgram: string | null;
  childrenEngaged: string | null;
  enoughResources: string | null;
  phonesCorrect: string | null;
  concerns: string | null;
  leisureReview: string | null;
  goals: string | null;
  programCompliance: string | null;
  prescribedInfoSighted: string[];
  clickupUrl: string;
}

function statusBadge(status: string) {
  if (status === "complete") return <Badge className="bg-green-100 text-green-800 border-green-300">Complete</Badge>;
  if (status === "needs further discussion") return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Needs Discussion</Badge>;
  return <Badge className="bg-gray-100 text-gray-700 border-gray-300">New</Badge>;
}

function YesNo({ value }: { value: string | null }) {
  if (!value) return <span className="flex items-center gap-1 text-gray-400 text-sm"><Minus className="h-4 w-4" /> N/A</span>;
  if (value === "Yes") return <span className="flex items-center gap-1 text-green-700 text-sm"><CheckCircle2 className="h-4 w-4" /> Yes</span>;
  return <span className="flex items-center gap-1 text-red-600 text-sm"><XCircle className="h-4 w-4" /> No</span>;
}

const CHECKLIST_FIELDS: { key: keyof ClickUpReport; label: string }[] = [
  { key: "staffOnTime", label: "Staff arrived on time & signed in" },
  { key: "staffUniform", label: "Staff in correct uniform" },
  { key: "plannedProgram", label: "Planned program in place" },
  { key: "childrenEngaged", label: "Children engaged appropriately" },
  { key: "enoughResources", label: "Enough resources/activities on offer" },
  { key: "phonesCorrect", label: "Phone & digital devices used correctly" },
];

function TextSection({ label, value }: { label: string; value: string | null }) {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  const preview = value.length > 120 ? value.slice(0, 120) + "…" : value;
  return (
    <div className="border-t pt-3 mt-3">
      <button
        className="flex items-center justify-between w-full text-sm font-medium text-left text-gray-700 hover:text-gray-900"
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{open ? value : preview}</p>
    </div>
  );
}

function ReportCard({ report }: { report: ClickUpReport }) {
  const dateFormatted = new Date(report.date + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">{dateFormatted}</CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {report.service && (
                <Badge variant="outline" className="font-mono text-xs">{report.service}</Badge>
              )}
              {statusBadge(report.status)}
            </div>
          </div>
          <a
            href={report.clickupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0 mt-1"
          >
            View in ClickUp <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHECKLIST_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-600">{label}</span>
              <YesNo value={report[key] as string | null} />
            </div>
          ))}
        </div>

        {report.prescribedInfoSighted.length > 0 && (
          <div className="border-t pt-3 mt-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Prescribed Information Sighted</p>
            <div className="flex flex-wrap gap-1">
              {report.prescribedInfoSighted.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">{label}</Badge>
              ))}
            </div>
          </div>
        )}

        {report.programCompliance && (
          <div className="border-t pt-3 mt-3">
            <p className="text-sm font-medium text-gray-700">Program Compliance</p>
            <p className="text-sm text-gray-600 mt-1">{report.programCompliance}</p>
          </div>
        )}

        <TextSection label="Concerns or Questions Raised" value={report.concerns} />
        <TextSection label="Leisure & Play Diary Review" value={report.leisureReview} />
        <TextSection label="Short & Long Term Goals" value={report.goals} />
      </CardContent>
    </Card>
  );
}

export default function ClickUpReports() {
  const { user } = useAuth();
  if (!user || user.type !== "staff" || user.role !== "admin") {
    return <Redirect to="/" />;
  }

  const { data: reports, isLoading, error, refetch } = useQuery<ClickUpReport[]>({
    queryKey: ["clickup-service-reports"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/clickup/service-reports`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const [filter, setFilter] = useState<string>("all");

  const filtered = reports?.filter((r) =>
    filter === "all" ? true : r.status === filter
  ) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Site Visits
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Service compliance walkthroughs from ClickUp</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "All" },
          { value: "new", label: "New" },
          { value: "needs further discussion", label: "Needs Discussion" },
          { value: "complete", label: "Complete" },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              filter === value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {label}
            {reports && value !== "all" && (
              <span className="ml-1 opacity-70">
                ({reports.filter((r) => r.status === value).length})
              </span>
            )}
            {reports && value === "all" && (
              <span className="ml-1 opacity-70">({reports.length})</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load reports. Check that the ClickUp API token is configured correctly.
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">No reports found.</div>
      )}

      <div className="space-y-4">
        {filtered.map((r) => <ReportCard key={r.id} report={r} />)}
      </div>
    </div>
  );
}
