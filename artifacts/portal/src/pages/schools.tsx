import { useGetSchools } from "@/hooks/use-schools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { format } from "date-fns";
import { Building2, Search, ArrowRight, ShieldBan, ShieldCheck, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SchoolItem } from "@/hooks/use-schools";

async function updateSchoolUsername(id: number, username: string) {
  const res = await fetch(`/api/reports/system-access/school/${id}/username`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update username");
}

async function updateSchoolPassword(id: number, password: string) {
  const res = await fetch(`/api/reports/system-access/school/${id}/set-password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to set password");
}

function EditSchoolLoginDialog({
  school,
  open,
  onClose,
}: {
  school: SchoolItem;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(school.username);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(nextUsername)) {
        throw new Error("Use 3–64 lowercase letters, numbers, dots, dashes, or underscores for the username.");
      }
      if (password && password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (password && password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      if (nextUsername !== school.username) {
        await updateSchoolUsername(school.id, nextUsername);
      }
      if (password) {
        await updateSchoolPassword(school.id, password);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/system-access"] });
      toast({
        title: "School login details updated",
        description: `${school.siteName} can use the new credentials.`,
      });
      handleClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleClose() {
    setUsername(school.username);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit login details — {school.siteName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor={`school-login-username-${school.id}`}>Username</Label>
            <Input
              id={`school-login-username-${school.id}`}
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              autoComplete="off"
              placeholder="school.username"
            />
            <p className="text-xs text-muted-foreground">
              Choose the username the school will enter on the login page.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`school-login-password-${school.id}`}>New password</Label>
            <Input
              id={`school-login-password-${school.id}`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={school.passwordSet ? "Leave blank to keep current password" : "Create a password"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`school-login-confirm-${school.id}`}>Confirm password</Label>
            <Input
              id={`school-login-confirm-${school.id}`}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Repeat the new password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => { setError(null); saveMutation.mutate(); }} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save login details"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Schools() {
  const { data: schools, isLoading } = useGetSchools();
  const [search, setSearch] = useState("");
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);

  const filtered = schools?.filter(s => 
    s.siteName.toLowerCase().includes(search.toLowerCase()) || 
    s.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 md:items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schools</h1>
          <p className="text-muted-foreground mt-1">
            Manage school portals and oversee their vital records and VECRA visits.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-4">
            <CardTitle>School Portals</CardTitle>
            <div className="ml-auto relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search schools..." 
                className="pl-8" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto opacity-20 mb-4" />
              <p>No schools found matching your search.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered?.map((school) => (
                <div key={school.id} className="group flex items-center p-4 hover:bg-muted/50 transition-colors">
                  <Link href={`/schools/${school.siteId}`} className="flex min-w-0 flex-1 items-center cursor-pointer">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mr-4">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {school.siteName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {school.username}
                        </span>
                        {school.blockedAt ? (
                          <Badge variant="destructive" className="h-5 text-[10px]">
                            <ShieldBan className="w-3 h-3 mr-1" />
                            Blocked
                          </Badge>
                        ) : school.passwordSet ? (
                          <Badge variant="secondary" className="h-5 text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-5 text-[10px]">
                            Pending Setup
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:block text-right mr-6">
                      <p className="text-xs text-muted-foreground">Last Login</p>
                      <p className="text-sm font-medium">
                        {school.lastLoginAt ? format(new Date(school.lastLoginAt), "MMM d, yyyy") : "Never"}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0" />
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-4 shrink-0 gap-1.5"
                    onClick={() => setEditingSchool(school)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Edit login</span>
                  </Button>
                  <EditSchoolLoginDialog
                    school={school}
                    open={editingSchool?.id === school.id}
                    onClose={() => setEditingSchool(null)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
