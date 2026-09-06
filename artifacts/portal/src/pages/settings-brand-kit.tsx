import { useLocation } from "wouter";
import { ArrowLeft, Copy, Check, Download, ImagePlus, Loader2, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

type Swatch = {
  name: string;
  token: string;
  hsl: string;
  hex: string;
  textClass: string;
  description: string;
};

const PALETTE: Swatch[] = [
  {
    name: "Brand Green",
    token: "--primary",
    hsl: "hsl(152 100% 27%)",
    hex: "#008848",
    textClass: "text-white",
    description: "Primary action colour. Buttons, links, focus rings, sidebar background.",
  },
  {
    name: "Sidebar Dark",
    token: "--sidebar-primary",
    hsl: "hsl(152 100% 22%)",
    hex: "#006E3A",
    textClass: "text-white",
    description: "Active sidebar item, deeper green for selected states.",
  },
  {
    name: "Sidebar Accent",
    token: "--sidebar-accent",
    hsl: "hsl(152 100% 32%)",
    hex: "#00A857",
    textClass: "text-white",
    description: "Hover state inside the sidebar navigation.",
  },
  {
    name: "Foreground",
    token: "--foreground",
    hsl: "hsl(220 15% 15%)",
    hex: "#1E2330",
    textClass: "text-white",
    description: "Primary text colour used for headings and body copy.",
  },
  {
    name: "Muted Foreground",
    token: "--muted-foreground",
    hsl: "hsl(220 10% 46%)",
    hex: "#6B7280",
    textClass: "text-white",
    description: "Secondary text — labels, hints, descriptions, timestamps.",
  },
  {
    name: "Muted",
    token: "--muted",
    hsl: "hsl(220 10% 95%)",
    hex: "#F0F1F5",
    textClass: "text-foreground",
    description: "Background wash for icon wells, empty states, subtle sections.",
  },
  {
    name: "Accent",
    token: "--accent",
    hsl: "hsl(220 10% 93%)",
    hex: "#EAEBF0",
    textClass: "text-foreground",
    description: "Hover backgrounds on cards, rows, and navigation items.",
  },
  {
    name: "Border",
    token: "--border",
    hsl: "hsl(220 13% 91%)",
    hex: "#E3E5EB",
    textClass: "text-foreground",
    description: "Default border for cards, inputs, and dividers.",
  },
  {
    name: "Background",
    token: "--background",
    hsl: "hsl(0 0% 100%)",
    hex: "#FFFFFF",
    textClass: "text-foreground",
    description: "Page background and card surface in light mode.",
  },
  {
    name: "Destructive",
    token: "--destructive",
    hsl: "hsl(0 60% 50%)",
    hex: "#CC3333",
    textClass: "text-white",
    description: "Errors, delete actions, and critical alert states.",
  },
];

const CHART_COLOURS = [
  { name: "Chart 1 — Forest", hsl: "hsl(156 48% 35%)", hex: "#2D8A5A" },
  { name: "Chart 2 — Leaf", hsl: "hsl(138 40% 50%)", hex: "#4DB870" },
  { name: "Chart 3 — Amber", hsl: "hsl(38 60% 65%)", hex: "#D4A04A" },
  { name: "Chart 4 — Terracotta", hsl: "hsl(10 50% 60%)", hex: "#CC6650" },
  { name: "Chart 5 — Lavender", hsl: "hsl(280 30% 55%)", hex: "#8A62A8" },
];

const RADIUS_VALUES = [
  { name: "sm", value: "0.25rem", example: "rounded-sm", use: "Tight UI chrome, inner badges" },
  { name: "md", value: "0.375rem", example: "rounded-md", use: "Icon wells, smaller inputs" },
  { name: "DEFAULT", value: "0.5rem", example: "rounded-lg", use: "Cards, dialogs, popover panels" },
  { name: "xl", value: "0.75rem", example: "rounded-xl", use: "Large modals, onboarding cards" },
  { name: "full", value: "9999px", example: "rounded-full", use: "Avatars, pill badges, toggle knobs" },
];

export default function SettingsBrandKit() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const [companyLogoPath, setCompanyLogoPath] = useState<string | null>(null);
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null);
  const [companyLogoLoading, setCompanyLogoLoading] = useState(true);
  const [companyLogoSaving, setCompanyLogoSaving] = useState(false);

  useEffect(() => {
    fetch("/api/email-settings")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load company logo");
        return response.json();
      })
      .then((settings) => setCompanyLogoPath(settings.companyLogoPath ?? null))
      .catch(() => toast({ title: "Unable to load company logo", variant: "destructive" }))
      .finally(() => setCompanyLogoLoading(false));
  }, [toast]);

  useEffect(() => () => {
    if (companyLogoPreview) URL.revokeObjectURL(companyLogoPreview);
  }, [companyLogoPreview]);

  function selectCompanyLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast({ title: "Please choose a PNG or JPG image", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Company logo must be smaller than 5 MB", variant: "destructive" });
      return;
    }
    setCompanyLogoFile(file);
    setCompanyLogoPreview(URL.createObjectURL(file));
  }

  async function uploadCompanyLogo(file: File): Promise<string> {
    const request = await fetch("/api/storage/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!request.ok) throw new Error("Unable to prepare the company logo upload");
    const { uploadURL, objectPath } = await request.json();
    const upload = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!upload.ok) throw new Error("Unable to upload the company logo");
    return objectPath;
  }

  async function saveCompanyLogo() {
    if (!companyLogoFile) return;
    setCompanyLogoSaving(true);
    try {
      const uploadedPath = await uploadCompanyLogo(companyLogoFile);
      const response = await fetch("/api/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyLogoPath: uploadedPath }),
      });
      if (!response.ok) throw new Error("Unable to save the company logo");
      setCompanyLogoPath(uploadedPath);
      setCompanyLogoFile(null);
      setCompanyLogoPreview(null);
      toast({ title: "Company logo saved", description: "It will appear before the company and service name in new school report PDFs." });
    } catch (error) {
      toast({
        title: "Unable to save company logo",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCompanyLogoSaving(false);
    }
  }

  async function removeCompanyLogo() {
    setCompanyLogoSaving(true);
    try {
      const response = await fetch("/api/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyLogoPath: null }),
      });
      if (!response.ok) throw new Error("Unable to remove the company logo");
      setCompanyLogoPath(null);
      setCompanyLogoFile(null);
      setCompanyLogoPreview(null);
      toast({ title: "Company logo removed" });
    } catch {
      toast({ title: "Unable to remove company logo", variant: "destructive" });
    } finally {
      setCompanyLogoSaving(false);
    }
  }

  const companyLogoUrl = companyLogoPreview ?? (companyLogoPath ? "/api/email-settings/company-logo" : null);

  return (
    <div className="space-y-12 max-w-4xl">
      <div className="flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Settings
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Download className="h-4 w-4 mr-1.5" /> Download as PDF
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand Kit</h1>
        <p className="text-muted-foreground mt-1">
          EduCare's design language — colours, type, components, and layout patterns used throughout the portal.
        </p>
      </div>

      {/* ── IDENTITY ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Identity</h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Logo</CardTitle>
            <p className="text-sm text-muted-foreground">
              This logo appears immediately before the company and service heading in newly generated school report PDFs.
            </p>
          </CardHeader>
          <CardContent>
            {companyLogoLoading ? (
              <div className="flex h-24 items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading company logo…
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => companyLogoInputRef.current?.click()}
                  className="flex h-24 w-52 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 transition-colors hover:border-primary/40 hover:bg-muted/50"
                >
                  {companyLogoUrl ? (
                    <img src={companyLogoUrl} alt="Company logo preview" className="max-h-20 max-w-48 object-contain p-2" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                      <ImagePlus className="h-7 w-7 opacity-50" />
                      Upload company logo
                    </span>
                  )}
                </button>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => companyLogoInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      {companyLogoUrl ? "Replace" : "Upload"}
                    </Button>
                    {companyLogoFile && (
                      <Button size="sm" onClick={saveCompanyLogo} disabled={companyLogoSaving}>
                        {companyLogoSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save logo
                      </Button>
                    )}
                    {companyLogoPath && !companyLogoFile && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={removeCompanyLogo} disabled={companyLogoSaving}>
                        <X className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PNG or JPG, up to 5 MB. A transparent PNG works best.</p>
                </div>
                <input
                  ref={companyLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={selectCompanyLogo}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Logo on brand green */}
          <Card className="overflow-hidden">
            <div
              className="flex flex-col items-center justify-center gap-3 p-10"
              style={{ background: "hsl(152 100% 27%)" }}
            >
              <img src="/educare-logo.png" alt="EduCare logo" className="h-16 w-16 object-contain" />
              <span className="text-white text-2xl font-bold tracking-tight">EduCare</span>
            </div>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Primary lockup — white logo + wordmark on Brand Green. Used on the login screen and printed materials.</p>
            </CardContent>
          </Card>

          {/* Logo on white */}
          <Card className="overflow-hidden">
            <div className="flex flex-col items-center justify-center gap-3 p-10 bg-white border-b">
              <img src="/educare-logo.png" alt="EduCare logo" className="h-16 w-16 object-contain" />
              <span className="text-foreground text-2xl font-bold tracking-tight">EduCare</span>
            </div>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Reversed lockup — logo + wordmark on white. Used inside the portal, reports, and email headers.</p>
            </CardContent>
          </Card>
        </div>

        {/* Login gradient strip */}
        <Card className="overflow-hidden">
          <div
            className="h-6 w-full"
            style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899)" }}
          />
          <div
            className="flex flex-col items-center justify-center gap-2 py-8"
            style={{ background: "linear-gradient(135deg, #1a4731 0%, #2d6a4f 50%, #1b5e20 100%)" }}
          >
            <span className="text-white/60 text-xs uppercase tracking-widest">Login background</span>
            <span className="text-white font-semibold text-sm">linear-gradient(135deg, #1a4731 → #2d6a4f → #1b5e20)</span>
          </div>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Login screen: deep forest gradient background with a seven-colour rainbow accent strip along the top of the sign-in card — representing diversity and inclusion.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ── COLOUR PALETTE ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Colour Palette</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PALETTE.map((s) => (
            <div key={s.token} className="rounded-lg border overflow-hidden flex">
              <div
                className={`w-16 shrink-0 flex items-center justify-center ${s.textClass}`}
                style={{ background: s.hsl }}
              />
              <div className="p-3 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold">{s.name}</span>
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <code className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground font-mono">{s.token}</code>
                  <CopyButton value={s.token} />
                  <span className="text-[10px] text-muted-foreground ml-1">{s.hex}</span>
                  <CopyButton value={s.hex} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Chart & data visualisation</p>
          <div className="flex gap-2 flex-wrap">
            {CHART_COLOURS.map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <div className="h-5 w-5 rounded-md border" style={{ background: c.hsl }} />
                <span className="text-muted-foreground">{c.name}</span>
                <CopyButton value={c.hex} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TYPOGRAPHY ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Typography</h2>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Typeface — Inter</p>
              <p className="text-muted-foreground text-sm">
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">--app-font-sans: 'Inter', sans-serif</code>
                &nbsp;— all UI text. Serif (Georgia) is reserved for printed learning-story documents only.
              </p>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-baseline gap-4">
                <span className="w-24 text-[10px] text-muted-foreground shrink-0">Display</span>
                <p className="text-3xl font-bold tracking-tight text-foreground">Page Title</p>
                <code className="text-[10px] text-muted-foreground font-mono">text-3xl font-bold tracking-tight</code>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="w-24 text-[10px] text-muted-foreground shrink-0">Section</span>
                <p className="text-xl font-semibold text-foreground">Section heading</p>
                <code className="text-[10px] text-muted-foreground font-mono">text-xl font-semibold</code>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="w-24 text-[10px] text-muted-foreground shrink-0">Label</span>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Group Label</p>
                <code className="text-[10px] text-muted-foreground font-mono">text-xs uppercase tracking-widest</code>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="w-24 text-[10px] text-muted-foreground shrink-0">Body</span>
                <p className="text-sm text-foreground">Regular body copy for forms and content areas.</p>
                <code className="text-[10px] text-muted-foreground font-mono">text-sm</code>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="w-24 text-[10px] text-muted-foreground shrink-0">Caption</span>
                <p className="text-xs text-muted-foreground leading-relaxed">Helper text, descriptions, timestamps, and secondary detail.</p>
                <code className="text-[10px] text-muted-foreground font-mono">text-xs text-muted-foreground</code>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="w-24 text-[10px] text-muted-foreground shrink-0">Code</span>
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-foreground">monospace snippet</code>
                <code className="text-[10px] text-muted-foreground font-mono">font-mono bg-muted rounded</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── SPACING & RADIUS ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Border Radius</h2>

        <div className="flex flex-wrap gap-4 items-end">
          {RADIUS_VALUES.map((r) => (
            <div key={r.name} className="flex flex-col items-center gap-2">
              <div
                className="h-14 w-14 bg-primary/15 border-2 border-primary/40"
                style={{ borderRadius: r.value }}
              />
              <div className="text-center">
                <p className="text-xs font-semibold">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">{r.value}</p>
                <p className="text-[10px] text-muted-foreground">{r.use}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BUTTONS ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Buttons</h2>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[
                { label: "Default (primary)", variant: "default" as const, note: "Primary actions — Save, Submit, Create" },
                { label: "Secondary", variant: "secondary" as const, note: "Supplementary actions alongside a primary" },
                { label: "Outline", variant: "outline" as const, note: "Neutral confirm, cancel, or secondary navigation" },
                { label: "Ghost", variant: "ghost" as const, note: "In-context actions, icon-only buttons, nav items" },
                { label: "Destructive", variant: "destructive" as const, note: "Delete, remove, or irreversible actions" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-4">
                  <div className="w-36 shrink-0">
                    <Button variant={b.variant} size="sm">{b.label}</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{b.note}</p>
                </div>
              ))}
              <div className="flex items-center gap-4 pt-2 border-t">
                <div className="flex gap-2 w-36 shrink-0">
                  <Button size="sm">Default</Button>
                  <Button size="icon" variant="outline" className="h-9 w-9">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Icon-only variant (size="icon") for toolbar and inline actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── BADGES ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Badges</h2>

        <Card>
          <CardContent className="p-6 flex flex-wrap gap-3 items-center">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge className="bg-primary/10 text-primary border-primary/20">Custom — info</Badge>
            <Badge className="bg-amber-50 text-amber-700 border-amber-200">Custom — warning</Badge>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Custom — success</Badge>
          </CardContent>
        </Card>
      </section>

      {/* ── CARDS ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cards & Surfaces</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Stat card */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Enrolled children</p>
              <p className="text-3xl font-bold tracking-tight text-foreground">42</p>
              <p className="text-xs text-muted-foreground mt-1">↑ 3 this month</p>
            </CardContent>
          </Card>

          {/* Tile card (settings-style) */}
          <Card className="cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0">
                <div className="h-4 w-4 bg-muted-foreground/30 rounded" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-0.5">Settings tile</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Hoverable card used across all settings group grids.</p>
              </div>
            </CardContent>
          </Card>

          {/* Header card */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Section card</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs text-muted-foreground">Used for form sections, detail panels, and content groupings with a visible heading.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── FORM CONTROLS ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Form Controls</h2>

        <Card>
          <CardContent className="p-6 space-y-4 max-w-sm">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Text input</label>
              <Input placeholder="e.g. Sunshine OSHC" />
              <p className="text-xs text-muted-foreground">Helper text explaining the field purpose.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Focused / active</label>
              <Input defaultValue="Active value" className="ring-2 ring-ring ring-offset-2" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Disabled</label>
              <Input placeholder="Not editable" disabled />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── ALERTS ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Alerts & Status</h2>

        <div className="space-y-3">
          <Alert>
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>Default alert — informational messages, tips, and guidance prompts.</AlertDescription>
          </Alert>
          <Alert className="border-primary/30 bg-primary/5 text-primary [&>svg]:text-primary">
            <Check className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription className="text-primary/80">Record saved. Changes are immediately visible to all staff members.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong. Please review the highlighted fields and try again.</AlertDescription>
          </Alert>
        </div>
      </section>

      {/* ── LAYOUT PATTERNS ───────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Layout Patterns</h2>

        <div className="space-y-6">
          {/* Page header pattern */}
          <Card>
            <CardHeader className="pb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Page header</p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Page Title</h1>
                  <p className="text-muted-foreground mt-1 text-sm">Descriptive subtitle explaining the page purpose and scope.</p>
                </div>
                <Button size="sm">Primary action</Button>
              </div>
            </CardContent>
          </Card>

          {/* List row pattern */}
          <Card>
            <CardHeader className="pb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">List row</p>
            </CardHeader>
            <CardContent className="p-0">
              {["Alex Johnson — Educator", "Sam Chen — Educational Leader", "Jordan Taylor — Admin"].map((name, i) => (
                <div
                  key={name}
                  className={`flex items-center justify-between px-6 py-3 hover:bg-accent/40 transition-colors ${i !== 2 ? "border-b" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs">
                      {name[0]}
                    </div>
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  <Button variant="ghost" size="sm">View</Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Responsive tile grid pattern */}
          <Card>
            <CardHeader className="pb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Tile grid (1 → 2 → 3 cols)</p>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {["Children", "Staff", "Observations"].map((label) => (
                  <div
                    key={label}
                    className="rounded-lg border p-4 text-sm font-medium text-center text-muted-foreground hover:border-primary/50 hover:bg-accent/30 cursor-pointer transition-colors"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                <code className="bg-muted px-1 py-0.5 rounded">grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3</code> — used on Settings, Dashboard widgets, and report summaries.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── ICONOGRAPHY ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Iconography</h2>

        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-foreground">
              All icons use <strong>Lucide React</strong> — a consistent, open-source stroke-icon library.
            </p>
            <div className="flex gap-4 flex-wrap text-muted-foreground">
              {[16, 18, 20, 24].map((size) => (
                <div key={size} className="flex flex-col items-center gap-1.5">
                  <Copy style={{ width: size, height: size }} />
                  <span className="text-[10px] text-muted-foreground">{size}px</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t space-y-1.5 text-xs text-muted-foreground">
              <p><code className="bg-muted px-1 py-0.5 rounded">h-4 w-4</code> — inline icons within buttons, nav items, and table cells (16 px)</p>
              <p><code className="bg-muted px-1 py-0.5 rounded">h-5 w-5</code> — icon-only buttons and input adornments (20 px)</p>
              <p><code className="bg-muted px-1 py-0.5 rounded">h-8 w-8</code> — large empty-state and section icons (32 px)</p>
              <p>Always pair <code className="bg-muted px-1 py-0.5 rounded">text-muted-foreground</code> for decorative icons; <code className="bg-muted px-1 py-0.5 rounded">text-primary</code> for active/emphasis icons.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── DARK MODE ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dark Mode</h2>

        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-foreground">
              The portal supports a full dark theme via the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.dark</code> CSS class.
              In dark mode, the sidebar switches from Brand Green to a deep navy (<code className="bg-muted px-1.5 py-0.5 rounded text-xs">hsl(220 20% 12%)</code>), and primary actions shift to a softer green (<code className="bg-muted px-1.5 py-0.5 rounded text-xs">hsl(156 30% 45%)</code>) for reduced eye strain.
            </p>
            <div className="rounded-lg border overflow-hidden">
              <div
                className="p-5 space-y-2"
                style={{
                  background: "hsl(220 20% 10%)",
                  borderBottom: "1px solid hsl(220 20% 18%)",
                }}
              >
                <p style={{ color: "hsl(40 20% 95%)", fontSize: "0.875rem", fontWeight: 600 }}>Dark mode surface</p>
                <p style={{ color: "hsl(220 15% 65%)", fontSize: "0.75rem" }}>Muted foreground text on dark background — <code style={{ background: "hsl(220 20% 18%)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>hsl(220 20% 10%)</code></p>
                <div
                  style={{
                    display: "inline-block",
                    background: "hsl(156 30% 45%)",
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "4px 12px",
                    borderRadius: 6,
                    marginTop: 4,
                  }}
                >
                  Dark primary button
                </div>
              </div>
              <div className="p-3 bg-muted">
                <p className="text-xs text-muted-foreground">Toggle dark mode from the sidebar footer. All tokens switch automatically via CSS variable overrides in the <code className="bg-background px-1 rounded">.dark</code> block of <code className="bg-background px-1 rounded">index.css</code>.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── VOICE & TONE ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Voice & Tone</h2>

        <Card>
          <CardContent className="p-6 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-foreground mb-2">Do</p>
                <ul className="space-y-1.5 text-muted-foreground text-xs">
                  <li className="flex gap-2"><Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Clear, action-first labels — "Add child", "Save changes"</li>
                  <li className="flex gap-2"><Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Sentence case for all UI labels and descriptions</li>
                  <li className="flex gap-2"><Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Australian English spelling (centre, colour, programme)</li>
                  <li className="flex gap-2"><Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Friendly but professional — like a senior educator speaking</li>
                  <li className="flex gap-2"><Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> Specific error messages with a recovery path</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-2">Don't</p>
                <ul className="space-y-1.5 text-muted-foreground text-xs">
                  <li className="flex gap-2"><span className="text-destructive font-bold shrink-0">✕</span> Title Case Every Word In A Label</li>
                  <li className="flex gap-2"><span className="text-destructive font-bold shrink-0">✕</span> Jargon or acronyms without explanation (MTOP is OK, NQS is always spelled out on first use)</li>
                  <li className="flex gap-2"><span className="text-destructive font-bold shrink-0">✕</span> Vague errors — "Something went wrong" alone is not enough</li>
                  <li className="flex gap-2"><span className="text-destructive font-bold shrink-0">✕</span> Exclamation marks in UI copy</li>
                  <li className="flex gap-2"><span className="text-destructive font-bold shrink-0">✕</span> American spelling (color, program, center)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
