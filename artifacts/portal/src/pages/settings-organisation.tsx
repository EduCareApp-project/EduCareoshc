import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, Copy, Check, Info, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Organisation = {
  id: number;
  organisationId: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

const ORG_ID_REGEX = /^\d{6}[A-Z]$/;

function validateOrgId(value: string): string | null {
  if (!value) return null;
  if (!/^\d{6}[A-Z]$/.test(value)) {
    return "Must be exactly 6 digits followed by 1 uppercase letter — e.g. 123456A";
  }
  return null;
}

export default function SettingsOrganisation() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [orgIdInput, setOrgIdInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery<Organisation | null>({
    queryKey: ["/api/organisation"],
    queryFn: async () => {
      const res = await fetch("/api/organisation");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setOrgIdInput(data.organisationId ?? "");
      setNameInput(data.name ?? "");
    }
  }, [data?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/organisation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId: orgIdInput.trim() || null,
          name: nameInput.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      return json;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/organisation"], updated);
      toast({ title: "Organisation settings saved" });
      setDirty(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const orgIdError = validateOrgId(orgIdInput);
  const canSave = dirty && !orgIdError;

  const handleCopy = async () => {
    if (!data?.organisationId) return;
    await navigator.clipboard.writeText(data.organisationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </button>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2.5">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Organisation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Identify this organisation for database assignment and multi-site management.</p>
          </div>
        </div>
      </div>

      {/* Current ID display */}
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : data?.organisationId ? (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">Current Organisation ID</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-mono font-bold tracking-widest text-foreground">
                {data.organisationId.slice(0, 6)}
                <span className="text-primary">{data.organisationId.slice(6)}</span>
              </p>
              <button
                onClick={handleCopy}
                className="ml-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {data.name && <p className="text-sm text-muted-foreground mt-1">{data.name}</p>}
          </div>
          <ShieldCheck className="h-10 w-10 text-primary/30 flex-shrink-0" />
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <p className="text-sm font-medium text-amber-800">No Organisation ID assigned yet</p>
          <p className="text-xs text-amber-600 mt-1">Enter one below to identify this organisation in the system.</p>
        </div>
      )}

      {/* Info box */}
      <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p><strong>Format:</strong> 6 digits followed by 1 uppercase letter — for example <code className="bg-blue-100 px-1 rounded">123456A</code></p>
          <p className="text-blue-600 text-xs">This ID uniquely identifies your organisation and will be used to assign and route databases as the platform scales to support multiple organisations.</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-card border rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-sm">Organisation Details</h2>

        <div className="space-y-2">
          <Label htmlFor="org-id">
            Organisation ID <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="org-id"
              value={orgIdInput}
              onChange={(e) => {
                setOrgIdInput(e.target.value.toUpperCase());
                setDirty(true);
              }}
              placeholder="e.g. 123456A"
              maxLength={7}
              className={`font-mono tracking-widest text-base ${orgIdError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {orgIdInput && !orgIdError && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
            )}
          </div>
          {orgIdError && (
            <p className="text-xs text-destructive">{orgIdError}</p>
          )}
          {!orgIdError && !orgIdInput && (
            <p className="text-xs text-muted-foreground">Enter 6 digits and a capital letter — the letter will be auto-uppercased as you type.</p>
          )}
          {!orgIdError && orgIdInput && ORG_ID_REGEX.test(orgIdInput) && (
            <p className="text-xs text-emerald-700 font-medium">✓ Valid format</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-name">Organisation Name</Label>
          <Input
            id="org-name"
            value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); setDirty(true); }}
            placeholder="e.g. Elysium OSHC Pty Ltd"
          />
          <p className="text-xs text-muted-foreground">The registered legal name of the organisation.</p>
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
