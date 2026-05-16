import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Upload, X, Loader2, ImagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type TemplateKey = "passwordReset" | "loginInvite" | "loginResend" | "postNotification" | "contactEnquiry";

interface TemplateForm {
  subject: string;
  intro: string;
}

interface FormState {
  senderName: string;
  logoPath: string | null;
  templates: Record<TemplateKey, TemplateForm>;
}

const TEMPLATE_LIST: { key: TemplateKey; label: string; description: string }[] = [
  { key: "passwordReset", label: "Password Reset", description: "Sent when staff or a guardian requests a password reset" },
  { key: "loginInvite", label: "Login Invitation", description: "Sent when inviting a new user to the portal" },
  { key: "loginResend", label: "Resend Login", description: "Sent when resending login details to an existing account" },
  { key: "postNotification", label: "Post Notification", description: "Sent to guardians when a new post is published" },
  { key: "contactEnquiry", label: "Contact Enquiry", description: "Internal notification when a contact form is submitted" },
];

const DEFAULTS: Record<TemplateKey, TemplateForm> = {
  passwordReset: {
    subject: "Reset your EduCare password",
    intro: "We received a request to reset the password for your EduCare Portal account.",
  },
  loginInvite: {
    subject: "You've been invited to EduCare Portal",
    intro: "Your account has been set up. Click the link below to choose a password and get started.",
  },
  loginResend: {
    subject: "Your EduCare Portal login details",
    intro: "Your account already has a password. Use the link below to set a new one.",
  },
  postNotification: {
    subject: "New post on Family Portal",
    intro: "A new post has been published on the Family Portal.",
  },
  contactEnquiry: {
    subject: "New enquiry from [Name] — [Service]",
    intro: "A new contact enquiry was submitted via the EduCare website.",
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildEmailPreview(
  key: TemplateKey,
  form: FormState,
  logoObjectUrl: string | null,
): string {
  const logoUrl = logoObjectUrl ?? (form.logoPath ? `/api/email-settings/logo` : null);
  const tpl = form.templates[key];
  const subject = esc(tpl.subject || DEFAULTS[key].subject);
  const intro = esc(tpl.intro || DEFAULTS[key].intro);
  const senderName = esc(form.senderName || "EduCare Portal");
  const accent = "#2d6a4f";

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${senderName}" style="height:52px;margin-bottom:20px;display:block;max-width:220px;object-fit:contain;" />`
    : `<div style="font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:20px;">${senderName}</div>`;

  const shell = (body: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  *{box-sizing:border-box;}
  body{margin:0;padding:16px;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;}
  .card{max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.10);}
  a{color:${accent};text-decoration:none;}
  .btn{display:inline-block;padding:12px 24px;background:${accent};color:#fff!important;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;}
</style></head><body>
<div class="card">${logoHtml}${body}</div>
</body></html>`;

  switch (key) {
    case "passwordReset":
      return shell(`
        <h2 style="margin:0 0 10px;font-size:22px;color:#111;">${subject}</h2>
        <p style="color:#555;margin:0 0 10px;">${intro}</p>
        <p style="color:#555;margin:0 0 20px;">Click the button below to set a new password. This link expires in <strong>4 hours</strong>.</p>
        <a class="btn" href="#">Reset password</a>
        <p style="color:#888;font-size:13px;margin:16px 0 0;">Or copy this URL into your browser:<br/><a href="#">https://portal.example.com/reset-password?token=…</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:12px;margin:0;">If you didn't request a password reset, you can safely ignore this email.</p>`);

    case "loginInvite":
    case "loginResend":
      return shell(`
        <h2 style="margin:0 0 10px;font-size:22px;color:#111;">${subject}</h2>
        <p style="color:#555;margin:0 0 6px;">Hi [Name],</p>
        <p style="color:#555;margin:0 0 16px;">${intro}</p>
        <table style="background:#f8f9fa;border-radius:8px;padding:8px 0;margin-bottom:16px;width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 12px;color:#888;font-size:13px;white-space:nowrap;">Login email</td>
            <td style="padding:6px 12px;font-weight:600;font-size:13px;">user@example.com</td>
          </tr>
          <tr>
            <td style="padding:6px 12px;color:#888;font-size:13px;white-space:nowrap;">Login page</td>
            <td style="padding:6px 12px;font-size:13px;"><a href="#">https://portal.example.com</a></td>
          </tr>
        </table>
        <a class="btn" href="#">${key === "loginInvite" ? "Set your password" : "Reset your password"}</a>
        <p style="color:#888;font-size:13px;margin:16px 0 0;">This link expires in <strong>4 hours</strong>. If you didn't expect this email, you can safely ignore it.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:12px;margin:0;">${senderName} — sent by your centre administrator.</p>`);

    case "postNotification":
      return shell(`
        <h2 style="margin:0 0 6px;font-size:22px;color:#111;">New post published</h2>
        <h3 style="margin:0 0 14px;color:${accent};font-size:17px;">Sample Post Title</h3>
        <p style="color:#555;margin:0 0 20px;">${intro}</p>
        <a class="btn" href="#">Read post</a>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:12px;margin:0;">You received this email because you have a Family Portal account.</p>`);

    case "contactEnquiry":
      return shell(`
        <h2 style="margin:0 0 4px;font-size:22px;color:#1b5e20;">New website enquiry</h2>
        <p style="color:#555;margin:0 0 20px;">${intro}</p>
        <table style="width:100%;border-collapse:collapse;background:#f8f9fa;border-radius:8px;margin-bottom:16px;">
          <tr><td style="padding:8px 12px;color:#888;font-size:13px;white-space:nowrap;vertical-align:top;">Name</td><td style="padding:8px 12px;font-weight:600;font-size:13px;">Jane Smith</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px;white-space:nowrap;vertical-align:top;">Email</td><td style="padding:8px 12px;font-size:13px;"><a href="mailto:jane@example.com">jane@example.com</a></td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px;white-space:nowrap;vertical-align:top;">Phone</td><td style="padding:8px 12px;font-size:13px;">0400 000 000</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px;white-space:nowrap;vertical-align:top;">Service</td><td style="padding:8px 12px;font-size:13px;">Elysium OSHC</td></tr>
          <tr><td style="padding:8px 12px;color:#888;font-size:13px;white-space:nowrap;vertical-align:top;">Message</td><td style="padding:8px 12px;font-size:13px;white-space:pre-wrap;">I'd like to enquire about enrolling my child.</td></tr>
        </table>
        <p style="color:#aaa;font-size:12px;margin:0;">Reply directly to this email to respond to Jane Smith.</p>`);

    default:
      return `<!DOCTYPE html><html><body><p>No preview.</p></body></html>`;
  }
}

const EMPTY_TEMPLATES = Object.fromEntries(
  TEMPLATE_LIST.map(({ key }) => [key, { subject: "", intro: "" }])
) as Record<TemplateKey, TemplateForm>;

export default function SettingsEmailNotifications() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [activeKey, setActiveKey] = useState<TemplateKey>("passwordReset");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [form, setForm] = useState<FormState>({
    senderName: "EduCare Portal",
    logoPath: null,
    templates: EMPTY_TEMPLATES,
  });

  useEffect(() => {
    fetch("/api/email-settings")
      .then((r) => r.json())
      .then((data) => {
        const saved = (data.templates ?? {}) as Partial<Record<TemplateKey, Partial<TemplateForm>>>;
        setForm({
          senderName: data.senderName ?? "EduCare Portal",
          logoPath: data.logoPath ?? null,
          templates: Object.fromEntries(
            TEMPLATE_LIST.map(({ key }) => [
              key,
              { subject: saved[key]?.subject ?? "", intro: saved[key]?.intro ?? "" },
            ])
          ) as Record<TemplateKey, TemplateForm>,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const html = buildEmailPreview(activeKey, form, logoObjectUrl);
    if (iframe.contentDocument) {
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
    } else {
      iframe.srcdoc = html;
    }
  }, [activeKey, form, logoObjectUrl]);

  function updateTemplate(key: TemplateKey, field: keyof TemplateForm, value: string) {
    setForm((f) => ({
      ...f,
      templates: { ...f.templates, [key]: { ...f.templates[key], [field]: value } },
    }));
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    setLogoFile(file);
    setLogoObjectUrl(URL.createObjectURL(file));
    e.target.value = "";
  }

  function clearLogo() {
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    setLogoFile(null);
    setLogoObjectUrl(null);
    setForm((f) => ({ ...f, logoPath: null }));
  }

  async function uploadLogo(file: File): Promise<string> {
    const { uploadURL, objectPath } = await fetch("/api/storage/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    }).then((r) => r.json());
    await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    return objectPath;
  }

  async function handleSave() {
    setSaving(true);
    try {
      let logoPath = form.logoPath;

      if (logoFile) {
        setLogoUploading(true);
        logoPath = await uploadLogo(logoFile);
        setLogoUploading(false);
        if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
        setLogoFile(null);
        setLogoObjectUrl(null);
      }

      const templates: Record<string, { subject?: string; intro?: string }> = {};
      for (const { key } of TEMPLATE_LIST) {
        const t = form.templates[key];
        const entry: { subject?: string; intro?: string } = {};
        if (t.subject.trim()) entry.subject = t.subject.trim();
        if (t.intro.trim()) entry.intro = t.intro.trim();
        if (Object.keys(entry).length) templates[key] = entry;
      }

      const updated = await fetch("/api/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName: form.senderName, logoPath, templates }),
      }).then((r) => r.json());

      setForm((f) => ({ ...f, logoPath: updated.logoPath ?? null }));
      toast({ title: "Email settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
      setLogoUploading(false);
    }
  }

  const activeMeta = TEMPLATE_LIST.find((t) => t.key === activeKey)!;
  const displayLogoUrl = logoObjectUrl ?? (form.logoPath ? `/api/email-settings/logo` : null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="gap-1.5 shrink-0">
            <ArrowLeft className="h-4 w-4" />
            Settings
          </Button>
          <div className="w-px h-5 bg-border shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">Email Notifications</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Customise the logo, sender name and text for every transactional email.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? (logoUploading ? "Uploading logo…" : "Saving…") : "Save changes"}
        </Button>
      </div>

      {/* Global Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Global Settings</CardTitle>
          <p className="text-xs text-muted-foreground">These apply to every email sent from EduCare.</p>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-6 flex-wrap">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Email Logo</Label>
            <div className="flex items-start gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer flex items-center justify-center w-44 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 hover:border-primary/40 transition-colors overflow-hidden"
              >
                {displayLogoUrl ? (
                  <img src={displayLogoUrl} alt="Logo preview" className="max-h-16 max-w-40 object-contain p-1" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImagePlus className="h-7 w-7 opacity-40" />
                    <span className="text-xs">Upload logo</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {displayLogoUrl ? "Replace" : "Upload"}
                </Button>
                {displayLogoUrl && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={clearLogo}>
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground max-w-[160px]">PNG or JPG. Shown at the top of every email.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoSelect}
              />
            </div>
          </div>

          {/* Sender name */}
          <div className="space-y-2 flex-1 min-w-[200px] max-w-xs">
            <Label htmlFor="senderName">Sender Name</Label>
            <Input
              id="senderName"
              value={form.senderName}
              onChange={(e) => setForm((f) => ({ ...f, senderName: e.target.value }))}
              placeholder="EduCare Portal"
            />
            <p className="text-xs text-muted-foreground">Shown as the "From" name in the recipient's inbox.</p>
          </div>
        </CardContent>
      </Card>

      {/* Template Editor */}
      <div className="grid grid-cols-[200px_1fr] gap-5 items-start">
        {/* Template list */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-1">Templates</p>
          {TEMPLATE_LIST.map(({ key, label, description }) => (
            <button
              key={key}
              onClick={() => setActiveKey(key)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                activeKey === key
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <div className="text-sm font-medium leading-tight">{label}</div>
              <div className={`text-xs mt-0.5 leading-snug ${activeKey === key ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {description}
              </div>
            </button>
          ))}
        </div>

        {/* Fields + preview */}
        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{activeMeta.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{activeMeta.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Subject line</Label>
                <Input
                  id="tpl-subject"
                  value={form.templates[activeKey].subject}
                  onChange={(e) => updateTemplate(activeKey, "subject", e.target.value)}
                  placeholder={DEFAULTS[activeKey].subject}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the default: <em>"{DEFAULTS[activeKey].subject}"</em>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-intro">Opening text</Label>
                <Textarea
                  id="tpl-intro"
                  value={form.templates[activeKey].intro}
                  onChange={(e) => updateTemplate(activeKey, "intro", e.target.value)}
                  placeholder={DEFAULTS[activeKey].intro}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Leave blank to use the default opening paragraph.</p>
              </div>
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/40">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live Preview</span>
              <span className="text-xs text-muted-foreground">{activeMeta.label}</span>
            </div>
            <iframe
              ref={iframeRef}
              className="w-full block"
              style={{ height: 520, border: "none" }}
              title={`${activeMeta.label} email preview`}
              sandbox="allow-same-origin"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
