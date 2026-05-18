import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  ChevronLeft, Upload, Download, CheckCircle2, XCircle,
  AlertCircle, Building2, Users, Baby, Loader2,
  FileText, X, SkipForward, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useListSites } from "@workspace/api-client-react";

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        result.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// ── CSV templates ─────────────────────────────────────────────────────────────
const TEMPLATES = {
  children: [
    "# EduCare Children & Guardians Import Template",
    "# One row per child. Guardian portal accounts are created automatically from guardianEmail.",
    "# username is optional — the guardian can set it on first login if left blank.",
    "# Date format: YYYY-MM-DD or DD/MM/YYYY",
    "# status values: active | inactive | waitlisted  (default: active)",
    "firstName,lastName,dateOfBirth,enrollmentDate,guardianName,guardianEmail,guardianPhone,medicalNotes,status,username",
    "Emma,Smith,2018-06-15,2024-01-22,Jane Smith,jane.smith@email.com,0412 345 678,,active,",
    "Liam,Jones,2020-03-01,2024-01-22,David Jones,david.jones@email.com,0487 654 321,Peanut allergy,active,davidj",
  ].join("\n"),

  staff: [
    "# EduCare Staff Import Template",
    "# role values: educator | coordinator | educational_leader | admin",
    "firstName,lastName,email,role,qualifications,phone,wwccNumber",
    "Sarah,Williams,sarah.williams@centre.com.au,educator,Certificate III,0411 222 333,WWC1234567E",
    "Michael,Brown,m.brown@centre.com.au,coordinator,Diploma of Early Childhood,0422 333 444,WWC7654321E",
  ].join("\n"),
};

function downloadTemplate(type: "children" | "staff") {
  const csv = TEMPLATES[type];
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `educare-${type}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import result ─────────────────────────────────────────────────────────────
type ImportResult = {
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; message: string; data?: string }>;
  guardianAccountsCreated?: number;
};

// ── File drop zone ────────────────────────────────────────────────────────────
function FileDropZone({
  onFile,
  fileName,
  onClear,
}: {
  onFile: (text: string, name: string) => void;
  fileName?: string;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => onFile(ev.target?.result as string, file.name);
      reader.readAsText(file);
    },
    [onFile],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onFile(ev.target?.result as string, file.name);
    reader.readAsText(file);
    e.target.value = "";
  };

  if (fileName) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <FileText className="h-5 w-5 text-primary shrink-0" />
        <span className="text-sm font-medium flex-1 truncate">{fileName}</span>
        <button onClick={onClear} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/30"
      }`}
    >
      <Upload className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground text-center">
        <span className="font-medium text-foreground">Click to browse</span> or drag & drop your CSV file here
      </p>
      <p className="text-xs text-muted-foreground">CSV files only</p>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleChange} />
    </div>
  );
}

// ── Result summary ────────────────────────────────────────────────────────────
function ResultSummary({ result, showGuardians }: { result: ImportResult; showGuardians?: boolean }) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">{result.inserted} inserted</span>
        </div>
        {showGuardians && (result.guardianAccountsCreated ?? 0) > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
            <UserCheck className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              {result.guardianAccountsCreated} guardian {result.guardianAccountsCreated === 1 ? "account" : "accounts"} created
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-3 py-2">
          <SkipForward className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{result.skipped} skipped (already exist)</span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-700 dark:text-red-400">{result.errors.length} errors</span>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 divide-y divide-destructive/10 max-h-48 overflow-y-auto">
          {result.errors.map((e, i) => (
            <div key={i} className="px-3 py-2 flex items-start gap-2">
              <span className="text-xs font-mono text-muted-foreground w-12 shrink-0 pt-0.5">Row {e.row}</span>
              <div className="min-w-0">
                {e.data && <p className="text-xs font-medium text-foreground truncate">{e.data}</p>}
                <p className="text-xs text-muted-foreground">{e.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Import tab content ────────────────────────────────────────────────────────
function ImportTab({
  type,
  siteId,
  description,
  requiresSite = true,
  showGuardians = false,
}: {
  type: "children" | "staff";
  siteId: number | null;
  description: React.ReactNode;
  requiresSite?: boolean;
  showGuardians?: boolean;
}) {
  const [fileName, setFileName] = useState<string>();
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(text: string, name: string) {
    const parsed = parseCSV(text);
    setRows(parsed);
    setFileName(name);
    setResult(null);
    setError(null);
  }

  function handleClear() {
    setFileName(undefined);
    setRows([]);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    if (requiresSite && !siteId) {
      setError("Please select an organisation before importing.");
      return;
    }
    if (rows.length === 0) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { rows };
      if (requiresSite) body.siteId = siteId;

      const res = await fetch(`/api/import/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Import failed (${res.status})`);
        return;
      }

      const data: ImportResult = await res.json();
      setResult(data);
      if (data.inserted > 0) handleClear();
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="text-sm text-muted-foreground">{description}</div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {rows.length > 0 ? `${rows.length} rows ready to import` : "No file selected"}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => downloadTemplate(type)}
        >
          <Download className="h-3.5 w-3.5" />
          Download template
        </Button>
      </div>

      <FileDropZone onFile={handleFile} fileName={fileName} onClear={handleClear} />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && <ResultSummary result={result} showGuardians={showGuardians} />}

      <div className="flex justify-end pt-1">
        <Button
          onClick={handleImport}
          disabled={loading || rows.length === 0 || (requiresSite && !siteId)}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {loading ? "Importing…" : `Import ${rows.length > 0 ? `${rows.length} rows` : ""}`}
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsDataImport() {
  const { data: sites, isLoading: sitesLoading } = useListSites();
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [siteSearch, setSiteSearch] = useState("");

  const filteredSites = (sites ?? []).filter(
    (s) =>
      siteSearch === "" ||
      s.name.toLowerCase().includes(siteSearch.toLowerCase()) ||
      String(s.id).includes(siteSearch),
  );

  const selectedSite = (sites ?? []).find((s) => s.id === selectedSiteId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Import</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bulk-import children and staff from CSV files. Guardian portal accounts are created automatically.
          </p>
        </div>
      </div>

      {/* Organisation selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Select Organisation / Site
          </CardTitle>
          <CardDescription>
            All imported records will be assigned to the selected site. Choose the correct site before uploading.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="text"
            placeholder="Search by site name or ID…"
            value={siteSearch}
            onChange={(e) => setSiteSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {sitesLoading ? (
            <p className="text-sm text-muted-foreground py-2">Loading sites…</p>
          ) : filteredSites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No sites found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {filteredSites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedSiteId === site.id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:border-primary/40 hover:bg-accent/30"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{site.name}</p>
                    {site.address && (
                      <p className="text-xs text-muted-foreground truncate">{site.address}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    ID: {site.id}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {selectedSite && (
            <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">
                Selected: <span className="text-primary">{selectedSite.name}</span>
                <span className="text-muted-foreground font-normal ml-2">(Site ID: {selectedSite.id})</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Import tabs */}
      <Tabs defaultValue="children">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="children" className="gap-2">
            <Baby className="h-4 w-4" />
            Children & Guardians
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="h-4 w-4" />
            Staff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="children">
          <Card>
            <CardContent className="pt-2 pb-6 px-6">
              <ImportTab
                type="children"
                siteId={selectedSiteId}
                showGuardians
                description={
                  <div className="space-y-2">
                    <p>
                      Upload one row per child. Each row also creates a <strong>guardian portal account</strong> using
                      the guardian's email address — so there is no separate guardian import step.
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                      <li>Duplicate children (matching name + guardian email) are skipped automatically.</li>
                      <li>If the guardian already has a portal account, it won't be duplicated.</li>
                      <li>
                        The <code className="font-mono bg-muted px-1 rounded text-xs">username</code> column is
                        optional — guardians can set their username on first login if left blank.
                      </li>
                    </ul>
                  </div>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardContent className="pt-2 pb-6 px-6">
              <ImportTab
                type="staff"
                siteId={selectedSiteId}
                description="Import staff members. Duplicates (matching email address) are skipped. Staff are created without a password — use 'Send Login Instructions' from their profile to set up access."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notes */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs space-y-1">
          <p><strong>Import notes:</strong></p>
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            <li>Rows with missing required fields are reported as errors and skipped — they do not block the rest of the import.</li>
            <li>Date formats accepted: YYYY-MM-DD or DD/MM/YYYY.</li>
            <li>Staff are imported without passwords. Send login instructions from each staff profile after import.</li>
            <li>Guardian portal accounts are created automatically when children are imported — no separate upload needed.</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
