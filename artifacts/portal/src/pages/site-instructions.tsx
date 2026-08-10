import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useListSites } from "@workspace/api-client-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, Pencil, Check, X, Plus, Trash2, Building2,
  MapPin, Phone, Mail, User, Clock, Camera, Upload, Loader2,
  GripVertical, Shield, Home, UtensilsCrossed, Smartphone,
  AtSign, Monitor, FileText, Download,
} from "lucide-react";
import { format } from "date-fns";
import { fmtMelb } from "@/lib/timezone";

// ── Types ──────────────────────────────────────────────────────────────────────
type QuickRef = {
  address?: string;
  securityCodes?: string;
  programType?: string;
  hours?: {
    bsc?: { open?: string; close?: string };
    asc?: { open?: string; close?: string };
    vac?: { open?: string; close?: string };
  };
};

type Section = { id: string; title: string; content: string };
type Contact = { id: string; name: string; role?: string; phone?: string; email?: string; notes?: string };
type SiteDoc = { id: string; name: string; path: string };

type SiteInstructionsData = {
  quickRef: QuickRef;
  sections: Section[];
  contacts: Contact[];
  photos: string[];
  documents: SiteDoc[];
  updatedAt: string | null;
};

// ── Defaults ───────────────────────────────────────────────────────────────────
const DEFAULT_SECTIONS: Section[] = [
  { id: "security", title: "Security", content: "" },
  { id: "oshc-room", title: "The OSHC Room", content: "" },
  { id: "meals", title: "Meals", content: "" },
  { id: "service-phone", title: "Service Phone", content: "" },
  { id: "service-email", title: "Service Email", content: "" },
  { id: "technology", title: "Technology Devices", content: "" },
];

const SECTION_ICONS: Record<string, React.ComponentType<any>> = {
  security: Shield,
  "oshc-room": Home,
  meals: UtensilsCrossed,
  "service-phone": Smartphone,
  "service-email": AtSign,
  technology: Monitor,
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function imageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────
async function fetchInstructions(siteId: number): Promise<SiteInstructionsData> {
  const res = await fetch(`/api/site-instructions/${siteId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load instructions");
  return res.json();
}

async function saveInstructions(siteId: number, data: Omit<SiteInstructionsData, "updatedAt" | "documents"> & { documents: SiteDoc[] }): Promise<SiteInstructionsData> {
  const res = await fetch(`/api/site-instructions/${siteId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save instructions");
  return res.json();
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SiteInstructions() {
  const { id } = useParams<{ id: string }>();
  const siteId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();
  const { isAdminOrEL } = usePermissions();
  const { toast } = useToast();
  const { data: sites } = useListSites();
  const { uploadFile, isUploading } = useUpload();

  const site = sites?.find((s) => s.id === siteId);

  const [instructions, setInstructions] = useState<SiteInstructionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state (separate from display state to allow cancel)
  const [editQuickRef, setEditQuickRef] = useState<QuickRef>({});
  const [editSections, setEditSections] = useState<Section[]>([]);
  const [editContacts, setEditContacts] = useState<Contact[]>([]);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editDocuments, setEditDocuments] = useState<SiteDoc[]>([]);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    fetchInstructions(siteId)
      .then((data) => {
        setInstructions(data);
        setLoading(false);
      })
      .catch(() => {
        toast({ title: "Failed to load site instructions", variant: "destructive" });
        setLoading(false);
      });
  }, [siteId]);

  function startEdit() {
    if (!instructions) return;
    setEditQuickRef({ ...instructions.quickRef });
    setEditSections(
      instructions.sections.length > 0
        ? instructions.sections.map((s) => ({ ...s }))
        : DEFAULT_SECTIONS.map((s) => ({ ...s }))
    );
    setEditContacts(instructions.contacts.map((c) => ({ ...c })));
    setEditPhotos([...instructions.photos]);
    setEditDocuments([...(instructions.documents ?? [])]);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await saveInstructions(siteId, {
        quickRef: editQuickRef,
        sections: editSections,
        contacts: editContacts,
        photos: editPhotos,
        documents: editDocuments,
      });
      setInstructions(saved);
      setEditing(false);
      toast({ title: "Site instructions saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Photo upload ─────────────────────────────────────────────────────────────
  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const res = await uploadFile(file);
      if (res?.objectPath) setEditPhotos((prev) => [...prev, res.objectPath]);
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    }
  }, [uploadFile, toast]);

  // ── Document upload ──────────────────────────────────────────────────────────
  const [isDocUploading, setIsDocUploading] = useState(false);

  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setIsDocUploading(true);
    try {
      for (const file of files) {
        const res = await uploadFile(file);
        if (res?.objectPath) {
          setEditDocuments((prev) => [...prev, { id: uid(), name: file.name, path: res.objectPath }]);
        }
      }
    } catch {
      toast({ title: "Document upload failed", variant: "destructive" });
    } finally {
      setIsDocUploading(false);
    }
  }, [uploadFile, toast]);

  function removeDocument(id: string) {
    setEditDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function updateDocName(id: string, name: string) {
    setEditDocuments((prev) => prev.map((d) => d.id === id ? { ...d, name } : d));
  }

  // ── Section helpers ──────────────────────────────────────────────────────────
  function addSection() {
    setEditSections((prev) => [...prev, { id: uid(), title: "New Section", content: "" }]);
  }

  function removeSection(id: string) {
    setEditSections((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSection(id: string, field: keyof Section, value: string) {
    setEditSections((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  // ── Contact helpers ──────────────────────────────────────────────────────────
  function addContact() {
    setEditContacts((prev) => [...prev, { id: uid(), name: "", role: "", phone: "", email: "", notes: "" }]);
  }

  function removeContact(id: string) {
    setEditContacts((prev) => prev.filter((c) => c.id !== id));
  }

  function updateContact(id: string, field: keyof Contact, value: string) {
    setEditContacts((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }

  // ── Display helpers ──────────────────────────────────────────────────────────
  const displaySections = editing
    ? editSections
    : (instructions?.sections.length ? instructions.sections : DEFAULT_SECTIONS);

  const displayQuickRef = editing ? editQuickRef : (instructions?.quickRef ?? {});
  const displayContacts = editing ? editContacts : (instructions?.contacts ?? []);
  const displayDocuments = editing ? editDocuments : (instructions?.documents ?? []);
  const displayPhotos = editing ? editPhotos : (instructions?.photos ?? []);
  const hasHours = displayQuickRef.hours && Object.values(displayQuickRef.hours).some((h) => h?.open || h?.close);

  if (!siteId) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/sites")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {loading ? <Skeleton className="h-7 w-48" /> : (site?.name ?? "Site Instructions")}
              </h1>
              <Badge variant="outline" className="hidden sm:flex items-center gap-1">
                <Building2 className="h-3 w-3" />Site Instructions
              </Badge>
            </div>
            {!loading && site?.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5" />{site.address}
              </p>
            )}
          </div>
        </div>

        {isAdminOrEL && !editing && !loading && (
          <Button variant="outline" onClick={startEdit} className="gap-2 shrink-0">
            <Pencil className="h-3.5 w-3.5" />Edit Instructions
          </Button>
        )}
        {editing && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={cancelEdit} disabled={saving}>
              <X className="h-4 w-4 mr-1.5" />Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Instructions
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : (
        <>
          {/* ── Quick Reference ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Reference</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Address</Label>
                      <Input
                        value={editQuickRef.address ?? ""}
                        onChange={(e) => setEditQuickRef((q) => ({ ...q, address: e.target.value }))}
                        placeholder="e.g. Silver Avenue, Frankston North VIC 3201"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Security Codes / FOB</Label>
                      <Input
                        value={editQuickRef.securityCodes ?? ""}
                        onChange={(e) => setEditQuickRef((q) => ({ ...q, securityCodes: e.target.value }))}
                        placeholder="e.g. FOB located on left wall inside front office"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Program Type</Label>
                      <Input
                        value={editQuickRef.programType ?? ""}
                        onChange={(e) => setEditQuickRef((q) => ({ ...q, programType: e.target.value }))}
                        placeholder="e.g. BSC, ASC, VAC"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Hours of Operation</Label>
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">Session</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Open</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Close</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(["bsc", "asc", "vac"] as const).map((session) => (
                            <tr key={session}>
                              <td className="px-3 py-2 font-medium uppercase text-xs text-muted-foreground">{session}</td>
                              <td className="px-3 py-2">
                                <Input
                                  value={editQuickRef.hours?.[session]?.open ?? ""}
                                  onChange={(e) => setEditQuickRef((q) => ({
                                    ...q,
                                    hours: { ...q.hours, [session]: { ...q.hours?.[session], open: e.target.value } },
                                  }))}
                                  placeholder="e.g. 7:00am"
                                  className="h-8 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  value={editQuickRef.hours?.[session]?.close ?? ""}
                                  onChange={(e) => setEditQuickRef((q) => ({
                                    ...q,
                                    hours: { ...q.hours, [session]: { ...q.hours?.[session], close: e.target.value } },
                                  }))}
                                  placeholder="e.g. 6:00pm"
                                  className="h-8 text-sm"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody className="divide-y">
                        {displayQuickRef.address && (
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground w-40 bg-muted/30">Address</td>
                            <td className="px-4 py-2.5">{displayQuickRef.address}</td>
                          </tr>
                        )}
                        {displayQuickRef.securityCodes && (
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground bg-muted/30">Security Codes</td>
                            <td className="px-4 py-2.5">{displayQuickRef.securityCodes}</td>
                          </tr>
                        )}
                        {displayQuickRef.programType && (
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground bg-muted/30">Program Type</td>
                            <td className="px-4 py-2.5">{displayQuickRef.programType}</td>
                          </tr>
                        )}
                        {!displayQuickRef.address && !displayQuickRef.securityCodes && !displayQuickRef.programType && !hasHours && (
                          <tr>
                            <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground text-sm italic">
                              {isAdminOrEL ? "Click Edit Instructions to add quick reference details." : "No quick reference information has been added yet."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {hasHours && (
                    <div>
                      <p className="text-sm font-medium mb-2 text-muted-foreground">Hours of Operation</p>
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground w-32">Session</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Open</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Close</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(["bsc", "asc", "vac"] as const).map((session) => {
                              const h = displayQuickRef.hours?.[session];
                              if (!h?.open && !h?.close) return null;
                              return (
                                <tr key={session}>
                                  <td className="px-4 py-2.5 font-semibold uppercase text-xs">{session}</td>
                                  <td className="px-4 py-2.5">{h?.open ?? "—"}</td>
                                  <td className="px-4 py-2.5">{h?.close ?? "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Photos ─────────────────────────────────────────────────────── */}
          {(editing || displayPhotos.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    Site Photos
                  </CardTitle>
                  {editing && (
                    <>
                      <Button
                        variant="outline" size="sm" className="gap-2 text-xs"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {isUploading ? "Uploading…" : "Upload Photo"}
                      </Button>
                      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {displayPhotos.length === 0 ? (
                  <div
                    className="border-2 border-dashed rounded-lg py-10 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/40 hover:bg-accent/20 transition-colors"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Click Upload Photo to add images of the service</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {displayPhotos.map((photo, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border">
                        <img
                          src={imageUrl(photo)}
                          alt={`Site photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {editing && (
                          <button
                            onClick={() => setEditPhotos((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {editing && (
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploading}
                        className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/40 hover:bg-accent/20 hover:text-primary transition-colors"
                      >
                        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                        <span className="text-xs">{isUploading ? "Uploading…" : "Add photo"}</span>
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Operational Sections ─────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Operational Instructions</h2>
              {editing && (
                <Button variant="outline" size="sm" onClick={addSection} className="gap-2 text-xs">
                  <Plus className="h-3.5 w-3.5" />Add Section
                </Button>
              )}
            </div>

            {displaySections.length === 0 && !editing ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  {isAdminOrEL ? "Click Edit Instructions to add operational sections." : "No operational instructions have been added yet."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {displaySections.map((section) => {
                  const SectionIcon = SECTION_ICONS[section.id] ?? Building2;
                  return (
                    <Card key={section.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          {editing && (
                            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
                          )}
                          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <SectionIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {editing ? (
                            <Input
                              value={section.title}
                              onChange={(e) => updateSection(section.id, "title", e.target.value)}
                              className="h-8 font-semibold text-base border-0 border-b rounded-none px-0 focus-visible:ring-0 bg-transparent"
                            />
                          ) : (
                            <CardTitle className="text-base">{section.title}</CardTitle>
                          )}
                          {editing && (
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                              onClick={() => removeSection(section.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {editing ? (
                          <Textarea
                            value={section.content}
                            onChange={(e) => updateSection(section.id, "content", e.target.value)}
                            placeholder={`Enter ${section.title.toLowerCase()} instructions…`}
                            className="min-h-[120px] resize-y text-sm"
                          />
                        ) : section.content ? (
                          <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                            {section.content}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            {isAdminOrEL ? "No content yet. Click Edit Instructions to add details." : "No instructions added for this section yet."}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Important Documents ──────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-sidebar text-sidebar-foreground rounded-full px-5 py-2.5">
              <h2 className="text-sm font-semibold tracking-wide">Important Documents</h2>
              {editing && (
                <>
                  <Button
                    variant="outline" size="sm" className="gap-2 text-xs"
                    onClick={() => docInputRef.current?.click()}
                    disabled={isDocUploading}
                  >
                    {isDocUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {isDocUploading ? "Uploading…" : "Upload Documents"}
                  </Button>
                  <input
                    ref={docInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleDocUpload}
                  />
                </>
              )}
            </div>

            {displayDocuments.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  {isAdminOrEL
                    ? (editing
                        ? <button onClick={() => docInputRef.current?.click()} className="flex flex-col items-center gap-2 w-full cursor-pointer hover:text-primary transition-colors">
                            <Upload className="h-7 w-7 opacity-40" />
                            Click Upload Documents to add files
                          </button>
                        : "Click Edit Instructions to upload important documents.")
                    : "No important documents have been added yet."}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y">
                  {displayDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      {editing ? (
                        <>
                          <input
                            value={doc.name}
                            onChange={(e) => updateDocName(doc.id, e.target.value)}
                            className="flex-1 text-sm bg-transparent border-0 border-b border-input focus:outline-none focus:border-primary py-0.5"
                          />
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeDocument(doc.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm truncate">{doc.name}</span>
                          <a
                            href={`/api/storage/objects/${doc.path.replace(/^\/objects\//, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-primary hover:text-primary/80 transition-colors"
                            title="Open document"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button
                      onClick={() => docInputRef.current?.click()}
                      disabled={isDocUploading}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:text-primary hover:bg-accent/30 transition-colors"
                    >
                      {isDocUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {isDocUploading ? "Uploading…" : "Add more documents"}
                    </button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Contacts ─────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Contacts</h2>
              {editing && (
                <Button variant="outline" size="sm" onClick={addContact} className="gap-2 text-xs">
                  <Plus className="h-3.5 w-3.5" />Add Contact
                </Button>
              )}
            </div>

            {displayContacts.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  {isAdminOrEL
                    ? (editing ? "Click Add Contact to add site contacts." : "Click Edit Instructions to add contacts.")
                    : "No contacts have been added yet."}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {displayContacts.map((contact) => (
                  <Card key={contact.id}>
                    <CardContent className="p-4 space-y-3">
                      {editing ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-2">
                              <Input
                                value={contact.name}
                                onChange={(e) => updateContact(contact.id, "name", e.target.value)}
                                placeholder="Contact name *"
                                className="font-medium"
                              />
                              <Input
                                value={contact.role ?? ""}
                                onChange={(e) => updateContact(contact.id, "role", e.target.value)}
                                placeholder="Role / Title"
                                className="text-sm"
                              />
                            </div>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeContact(contact.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <Input
                                value={contact.phone ?? ""}
                                onChange={(e) => updateContact(contact.id, "phone", e.target.value)}
                                placeholder="Phone"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <Input
                                value={contact.email ?? ""}
                                onChange={(e) => updateContact(contact.id, "email", e.target.value)}
                                placeholder="Email"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <Textarea
                            value={contact.notes ?? ""}
                            onChange={(e) => updateContact(contact.id, "notes", e.target.value)}
                            placeholder="Notes about this contact…"
                            className="min-h-[72px] text-sm resize-none"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-2.5">
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold leading-snug">{contact.name}</p>
                              {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
                            </div>
                          </div>
                          <div className="space-y-1.5 text-sm">
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span>{contact.phone}</span>
                              </a>
                            )}
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{contact.email}</span>
                              </a>
                            )}
                          </div>
                          {contact.notes && (
                            <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 leading-relaxed whitespace-pre-wrap border">
                              {contact.notes}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          {instructions?.updatedAt && (
            <p className="text-xs text-muted-foreground text-right pb-2">
              <Clock className="h-3 w-3 inline mr-1" />
              Last updated {fmtMelb(instructions.updatedAt, "dd/MM/yyyy 'at' h:mm a")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
