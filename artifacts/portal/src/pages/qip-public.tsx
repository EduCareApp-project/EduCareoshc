import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Download, CheckCircle2, TrendingUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const QA_AREAS = [
  { key: "1", label: "Quality Area 1: Educational Program and Practice" },
  { key: "2", label: "Quality Area 2: Children's Health and Safety" },
  { key: "3", label: "Quality Area 3: Physical Environment" },
  { key: "4", label: "Quality Area 4: Staffing Arrangements" },
  { key: "5", label: "Quality Area 5: Relationships with Children" },
  { key: "6", label: "Quality Area 6: Collaborative Partnerships with Families and Communities" },
  { key: "7", label: "Quality Area 7: Governance and Leadership" },
];

const QA_COLOURS: Record<string, { bg: string; text: string; light: string; border: string; strengthsText: string }> = {
  "1": { bg: "#7DC242", text: "#fff", light: "#edf7dc", border: "#7DC242", strengthsText: "#3a6b17" },
  "2": { bg: "#FFD100", text: "#333", light: "#fffbe0", border: "#FFD100", strengthsText: "#6b5000" },
  "3": { bg: "#F49AC2", text: "#fff", light: "#fef0f7", border: "#F49AC2", strengthsText: "#7a2a55" },
  "4": { bg: "#A8CC44", text: "#fff", light: "#f1f8df", border: "#A8CC44", strengthsText: "#446618" },
  "5": { bg: "#F7941D", text: "#fff", light: "#fff4e0", border: "#F7941D", strengthsText: "#7a4200" },
  "6": { bg: "#BE2180", text: "#fff", light: "#fce8f4", border: "#BE2180", strengthsText: "#6d0f48" },
  "7": { bg: "#00AEEF", text: "#fff", light: "#e0f5fd", border: "#00AEEF", strengthsText: "#005878" },
};

const PRIORITY_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
  medium: { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
  low:    { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
};

type PublicData = {
  siteName: string | null;
  strengths: { qualityArea: string; content: string }[];
  items: {
    id: number;
    qualityArea: string | null;
    standardElement: string | null;
    priority: string | null;
    issueIdentified: string | null;
    outcomeGoal: string | null;
    howToAchieve: string | null;
    successMeasure: string | null;
    progressNotes: string | null;
    dueDate: string | null;
  }[];
};

export default function QipPublic() {
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const params = new URLSearchParams(window.location.search);
  const siteId = params.get("siteId");
  const pageUrl = window.location.href;

  useEffect(() => {
    const url = siteId ? `/api/qip/public?siteId=${siteId}` : `/api/qip/public`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Unable to load QIP data."); setLoading(false); });
  }, [siteId]);

  function downloadQR() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const scale = 4;
    canvas.width = 256 * scale;
    canvas.height = 256 * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.download = `qip-qr-${data?.siteName?.toLowerCase().replace(/\s+/g, "-") ?? "service"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  const qaWithContent = QA_AREAS.filter((a) => {
    const hasStrength = data?.strengths.some((s) => s.qualityArea === a.key && s.content?.trim());
    const hasItems = data?.items.some((i) => i.qualityArea === a.key);
    return hasStrength || hasItems;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground leading-tight">Quality Improvement Plan</h1>
            {data?.siteName && (
              <p className="text-sm text-muted-foreground">{data.siteName}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading…
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* QR Code section */}
            <div className="bg-white rounded-xl border shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
              <div ref={qrRef} className="shrink-0 p-3 bg-white border rounded-lg shadow-inner">
                <QRCode value={pageUrl} size={180} />
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h2 className="text-lg font-semibold mb-1">Share this page</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Scan this QR code or share the link below to give families and community members access to this service's Quality Improvement Plan.
                </p>
                <div className="bg-gray-50 rounded-md border px-3 py-2 text-xs text-muted-foreground font-mono break-all mb-4">
                  {pageUrl}
                </div>
                <Button variant="outline" size="sm" onClick={downloadQR}>
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </div>

            {/* Intro */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-base font-semibold mb-2">About This Plan</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This Quality Improvement Plan (QIP) outlines the strengths of our service and the areas we are actively working to improve across all seven National Quality Standard (NQS) quality areas. It reflects our commitment to continuous improvement and delivering high-quality education and care.
              </p>
            </div>

            {/* Quality Areas */}
            {qaWithContent.length === 0 ? (
              <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No Quality Improvement Plan content has been published yet.</p>
              </div>
            ) : (
              qaWithContent.map((area) => {
                const colour = QA_COLOURS[area.key];
                const strength = data.strengths.find((s) => s.qualityArea === area.key);
                const areaItems = data.items.filter((i) => i.qualityArea === area.key);

                return (
                  <div key={area.key} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    {/* Area header */}
                    <div className="px-6 py-4" style={{ backgroundColor: colour.bg }}>
                      <h3 className="text-base font-bold" style={{ color: colour.text }}>{area.label}</h3>
                    </div>

                    <div className="p-6 space-y-5">
                      {/* Strengths */}
                      {strength?.content?.trim() && (
                        <div className="rounded-lg p-4" style={{ backgroundColor: colour.light, border: `1px solid ${colour.border}40` }}>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: colour.strengthsText }} />
                            <h4 className="text-sm font-semibold" style={{ color: colour.strengthsText }}>Strengths of the Service</h4>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: colour.strengthsText }}>{strength.content}</p>
                        </div>
                      )}

                      {/* Improvement items */}
                      {areaItems.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            Areas for Improvement
                          </h4>
                          <div className="space-y-3">
                            {areaItems.map((item) => {
                              const pc = PRIORITY_COLOURS[item.priority ?? "medium"] ?? PRIORITY_COLOURS.medium;
                              const priorityLabel = (item.priority ?? "medium").charAt(0).toUpperCase() + (item.priority ?? "medium").slice(1);
                              return (
                                <div key={item.id} className="rounded-lg border p-4 space-y-3">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    {item.standardElement && (
                                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        NQS {item.standardElement}
                                      </span>
                                    )}
                                    <span
                                      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full border"
                                      style={{ backgroundColor: pc.bg, color: pc.text, borderColor: pc.border }}
                                    >
                                      {priorityLabel} Priority
                                    </span>
                                    {item.dueDate && (
                                      <span className="text-xs text-muted-foreground">
                                        Due: {new Date(item.dueDate).toLocaleDateString("en-AU")}
                                      </span>
                                    )}
                                  </div>

                                  {item.issueIdentified && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Issue Identified</p>
                                      <p className="text-sm text-gray-700">{item.issueIdentified}</p>
                                    </div>
                                  )}
                                  {item.outcomeGoal && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Outcome / Goal</p>
                                      <p className="text-sm text-gray-700">{item.outcomeGoal}</p>
                                    </div>
                                  )}
                                  {item.howToAchieve && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">How We Will Achieve This</p>
                                      <p className="text-sm text-gray-700">{item.howToAchieve}</p>
                                    </div>
                                  )}
                                  {item.successMeasure && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Success Measure</p>
                                      <p className="text-sm text-gray-700">{item.successMeasure}</p>
                                    </div>
                                  )}
                                  {item.progressNotes && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Progress</p>
                                      <p className="text-sm text-gray-700">{item.progressNotes}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pb-8">
              <p>This Quality Improvement Plan is published in accordance with the National Quality Framework.</p>
              <p className="mt-1">Last updated: {new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long" })}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
