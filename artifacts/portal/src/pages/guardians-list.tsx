import { useListGuardians } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, Phone, Users, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function GuardiansList() {
  const { data: guardians, isLoading } = useListGuardians();
  const [search, setSearch] = useState("");

  const filtered = (guardians ?? []).filter((g) => {
    const q = search.toLowerCase();
    return (
      g.guardianName.toLowerCase().includes(q) ||
      g.guardianEmail.toLowerCase().includes(q) ||
      g.childNames.some((n) => n.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guardians</h1>
          <p className="text-muted-foreground mt-1">
            Parent and guardian accounts linked to enrolled children.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or child..."
          className="pl-9 w-full sm:w-80 bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            {search ? "No guardians match your search." : "No guardians found. Enrol children to see their guardians here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <Link key={g.guardianEmail} href={`/guardians/${encodeURIComponent(g.guardianEmail)}`}>
              <div className="bg-card border rounded-xl p-5 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer h-full flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base font-bold shrink-0">
                    {initials(g.guardianName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base truncate">{g.guardianName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {g.guardianEmail}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      {g.guardianPhone}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {g.childNames.map((name, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>

                <div className="mt-auto flex items-center gap-2">
                  {g.hasPassword ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Account active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldOff className="h-3.5 w-3.5" />
                      No account set up
                    </span>
                  )}
                  {g.username && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                      <KeyRound className="h-3 w-3" />
                      {g.username}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
