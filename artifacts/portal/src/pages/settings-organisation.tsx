import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, Copy, Check, Info, ShieldCheck, Phone, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Organisation = {
  id: number;
  organisationId: string | null;
  name: string | null;
  approvalNumber: string | null;
  abn: string | null;
  servicePhone: string | null;
  serviceEmail: string | null;
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
  const [approvalNumber, setApprovalNumber] = useState("");
  const [abn, setAbn] = useState("");
  const [servicePhone, setServicePhone] = useState("");
  const [serviceEmail, setServiceEmail] = useState("");
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
      setApprovalNumber(data.approvalNumber ?? "");
      setAbn(data.abn ?? "");
      setServicePhone(data.servicePhone ?? "");
      setServiceEmail(data.serviceEmail ?? "");
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
          approvalNumber: approvalNumber.trim() || null,
          abn: abn.trim() || null,
          servicePhone: servicePhone.trim() || null,
          serviceEmail: serviceEmail.trim() || null,
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

  function markDirty() { setDirty(true); }

  return (
    <div className="max-w-2xl space-y-8">
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
            <p className="text-sm text-muted-foreground mt-0.5">Manage your organisation's identity, approval details and contact information.</p>
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
          <p><strong>Organisation ID format:</strong> 6 digits followed by 1 uppercase letter — for example <code className="bg-blue-100 px-1 rounded">123456A</code></p>
          <p className="text-blue-600 text-xs">This ID uniquely identifies your organisation and is used for database assignment across multi-site deployments.</p>
        </div>
      </div>

      {/* Organisation Details */}
      <Card>
        <CardHeader>
          <CardTitle>Organisation Details</CardTitle>
          <CardDescription>Legal identity and system identifier for this organisation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="org-id">
              Organisation ID <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="org-id"
                value={orgIdInput}
                onChange={(e) => { setOrgIdInput(e.target.value.toUpperCase()); markDirty(); }}
                placeholder="e.g. 123456A"
                maxLength={7}
                className={`font-mono tracking-widest text-base ${orgIdError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {orgIdInput && !orgIdError && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
              )}
            </div>
            {orgIdError && <p className="text-xs text-destructive">{orgIdError}</p>}
            {!orgIdError && orgIdInput && ORG_ID_REGEX.test(orgIdInput) && (
              <p className="text-xs text-emerald-700 font-medium">Valid format</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-name">Organisation Name</Label>
            <Input
              id="org-name"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); markDirty(); }}
              placeholder="e.g. Elysium OSHC Pty Ltd"
            />
            <p className="text-xs text-muted-foreground">The registered legal name of the organisation.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="abn">ABN</Label>
            <Input
              id="abn"
              value={abn}
              onChange={(e) => { setAbn(e.target.value); markDirty(); }}
              placeholder="e.g. 12 345 678 901"
              maxLength={14}
            />
            <p className="text-xs text-muted-foreground">Australian Business Number — 11 digits.</p>
          </div>
        </CardContent>
      </Card>

      {/* Service Details */}
      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
          <CardDescription>Approval number and public contact information for this service.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="approval-number">Service Approval Number</Label>
            <Input
              id="approval-number"
              value={approvalNumber}
              onChange={(e) => { setApprovalNumber(e.target.value); markDirty(); }}
              placeholder="e.g. SA-20-12345"
            />
            <p className="text-xs text-muted-foreground">The service approval number issued by the relevant state or territory regulatory authority.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-phone">
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Service Phone</span>
            </Label>
            <Input
              id="service-phone"
              type="tel"
              value={servicePhone}
              onChange={(e) => { setServicePhone(e.target.value); markDirty(); }}
              placeholder="e.g. (03) 9000 0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-email">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Service Email</span>
            </Label>
            <Input
              id="service-email"
              type="email"
              value={serviceEmail}
              onChange={(e) => { setServiceEmail(e.target.value); markDirty(); }}
              placeholder="e.g. info@myservice.edu.au"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!canSave || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving…" : "Save Organisation Settings"}
        </Button>
      </div>
    </div>
  );
}
