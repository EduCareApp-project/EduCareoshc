import { useGetSchools } from "@/hooks/use-schools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { format } from "date-fns";
import { Building2, Search, ArrowRight, ShieldBan, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Schools() {
  const { data: schools, isLoading } = useGetSchools();
  const [search, setSearch] = useState("");

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
                <Link key={school.id} href={`/schools/${school.siteId}`}>
                  <div className="group flex items-center p-4 hover:bg-muted/50 transition-colors cursor-pointer">
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
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
