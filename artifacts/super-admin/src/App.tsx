import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.json();
}

type Org = {
  id: number;
  name: string;
  domain: string | null;
  logo_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: "active" | "provisioning" | "archived";
  notes: string | null;
  created_at: string;
};

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  provisioning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  archived: "bg-gray-100 text-gray-600 border-gray-200",
};

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/super-admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      qc.setQueryData(["sa-session"], { email: data.email });
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar to-sidebar/80">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <svg className="w-7 h-7 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Super Admin</CardTitle>
          <CardDescription>EduCare Platform Administration</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function OrgDialog({
  open,
  org,
  onClose,
}: {
  open: boolean;
  org: Org | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!org;

  const [form, setForm] = useState({
    name: "",
    domain: "",
    logo_url: "",
    contact_name: "",
    contact_email: "",
    status: "active",
    notes: "",
  });

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name,
        domain: org.domain ?? "",
        logo_url: org.logo_url ?? "",
        contact_name: org.contact_name ?? "",
        contact_email: org.contact_email ?? "",
        status: org.status,
        notes: org.notes ?? "",
      });
    } else {
      setForm({ name: "", domain: "", logo_url: "", contact_name: "", contact_email: "", status: "active", notes: "" });
    }
  }, [org, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        domain: form.domain || null,
        logo_url: form.logo_url || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        notes: form.notes || null,
      };
      if (isEdit) {
        return apiFetch(`/super-admin/orgs/${org!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        return apiFetch("/super-admin/orgs", { method: "POST", body: JSON.stringify(body) });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-orgs"] });
      toast({ title: isEdit ? "Organisation updated" : "Organisation registered" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Organisation" : "Register Organisation"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Organisation Name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Acme OSHC" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Portal Domain</Label>
              <Input value={form.domain} onChange={e => set("domain", e.target.value)} placeholder="https://acme.educareoshc.com.au" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} placeholder="jane@acme.com.au" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="provisioning">Provisioning</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Logo URL</Label>
              <Input value={form.logo_url} onChange={e => set("logo_url", e.target.value)} placeholder="https://…/logo.png" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Internal notes…" rows={3} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ResendResult = {
  posts: number;
  emails: number;
  summary: { postId: number; title: string; sent: number }[];
  errors: string[];
};

function MaintenancePanel() {
  const { toast } = useToast();
  const [hours, setHours] = useState("48");
  const [result, setResult] = useState<ResendResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const data: ResendResult = await apiFetch(
        `/super-admin/resend-post-notifications?hours=${encodeURIComponent(hours)}`,
        { method: "POST" },
      );
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: data.emails > 0
          ? `Sent ${data.emails} email${data.emails !== 1 ? "s" : ""} across ${data.posts} post${data.posts !== 1 ? "s" : ""}`
          : `No published posts found in the last ${hours} hours`,
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resend Post Notifications</CardTitle>
        <CardDescription>
          Re-send guardian notification emails for all posts published in the last N hours.
          Use this after a sending failure (e.g. SMTP rate-limit error).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Look-back window (hours)</label>
            <input
              type="number"
              min={1}
              max={168}
              value={hours}
              onChange={e => setHours(e.target.value)}
              className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button
            className="mt-5"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Sending…" : "Resend Notifications"}
          </Button>
        </div>
        {result && (
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm space-y-2">
            <p className="font-medium">
              {result.emails > 0
                ? `✓ Dispatched ${result.emails} email${result.emails !== 1 ? "s" : ""} for ${result.posts} post${result.posts !== 1 ? "s" : ""}`
                : "No posts found in that window"}
            </p>
            {result.summary.map(s => (
              <p key={s.postId} className="text-muted-foreground text-xs">
                • <span className="font-medium text-foreground">{s.title}</span> — {s.sent} recipient{s.sent !== 1 ? "s" : ""}
              </p>
            ))}
            {result.errors.length > 0 && (
              <p className="text-destructive text-xs mt-1">
                Errors: {result.errors.join(", ")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HubPage({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [activeTab, setActiveTab] = useState<"orgs" | "maintenance">("orgs");

  const { data: orgs = [], isLoading } = useQuery<Org[]>({
    queryKey: ["sa-orgs"],
    queryFn: () => apiFetch("/super-admin/orgs"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/super-admin/orgs/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sa-orgs"] }); toast({ title: "Organisation removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openAdd() { setEditOrg(null); setDialogOpen(true); }
  function openEdit(org: Org) { setEditOrg(org); setDialogOpen(true); }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-sidebar-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Super Admin</p>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5">EduCare Platform</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <button
            onClick={() => setActiveTab("orgs")}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${activeTab === "orgs" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Organisations
          </button>
          <button
            onClick={() => setActiveTab("maintenance")}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${activeTab === "maintenance" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Maintenance
          </button>
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
          <div>
            <h1 className="text-xl font-semibold">
              {activeTab === "orgs" ? "Organisation Registry" : "Maintenance"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeTab === "orgs"
                ? `${orgs.length} organisation${orgs.length !== 1 ? "s" : ""} registered`
                : "Admin tools and one-off operations"}
            </p>
          </div>
          {activeTab === "orgs" && (
            <Button onClick={openAdd}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Register Organisation
            </Button>
          )}
        </header>

        <div className="flex-1 p-8">
          {activeTab === "maintenance" ? (
            <div className="max-w-xl">
              <MaintenancePanel />
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
          ) : orgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No organisations yet. Register the first one.</p>
              <Button size="sm" onClick={openAdd}>Register Organisation</Button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {orgs.map(org => (
                <Card key={org.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt="" className="w-10 h-10 rounded-lg object-contain border border-border shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-primary font-bold text-sm">{org.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{org.name}</CardTitle>
                          {org.domain && (
                            <a
                              href={org.domain}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary truncate block mt-0.5"
                            >
                              {org.domain.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                        </div>
                      </div>
                      <Badge className={`text-xs shrink-0 border ${STATUS_COLOURS[org.status]}`}>
                        {org.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pt-0 space-y-2">
                    {(org.contact_name || org.contact_email) && (
                      <div className="text-xs text-muted-foreground">
                        {org.contact_name && <p className="font-medium text-foreground">{org.contact_name}</p>}
                        {org.contact_email && <p>{org.contact_email}</p>}
                      </div>
                    )}
                    {org.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{org.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Registered {new Date(org.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {org.domain && (
                      <div className="pt-1">
                        <a href={org.domain} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="w-full text-xs">
                            Open Portal
                            <svg className="w-3 h-3 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Button>
                        </a>
                      </div>
                    )}
                  </CardContent>
                  <div className="px-6 pb-4 flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => openEdit(org)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Remove "${org.name}"?`)) deleteMutation.mutate(org.id);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <OrgDialog open={dialogOpen} org={editOrg} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function AuthGate() {
  const qc = useQueryClient();
  const { data: session, isLoading } = useQuery({
    queryKey: ["sa-session"],
    queryFn: () => apiFetch("/super-admin/session").catch(() => null),
    retry: false,
  });

  async function logout() {
    await apiFetch("/super-admin/logout", { method: "POST" }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["sa-session"] });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) return <LoginPage />;
  return <HubPage onLogout={logout} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthGate} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={BASE}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
