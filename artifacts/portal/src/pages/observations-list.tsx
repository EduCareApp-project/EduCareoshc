import { useListObservations, useListChildren } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Calendar, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useState } from "react";

export default function ObservationsList() {
  const { data: observations, isLoading } = useListObservations();
  const [search, setSearch] = useState("");

  const filteredObs = observations?.filter(obs => 
    obs.title.toLowerCase().includes(search.toLowerCase()) || 
    obs.childName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Observations</h1>
          <p className="text-muted-foreground mt-1">Review learning observations and documentation.</p>
        </div>
        <Link href="/observations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Observation
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by title or child name..." 
          className="pl-9 max-w-md bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : filteredObs?.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-dashed">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-1">No observations found</h3>
          <p className="text-muted-foreground">Document a child's learning moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredObs?.map((obs) => (
            <Link key={obs.id} href={`/observations/${obs.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary leading-tight">
                      {obs.title}
                    </h3>
                    <div className="flex items-center text-xs text-muted-foreground bg-accent/50 px-2 py-1 rounded shrink-0 ml-4">
                      <Calendar className="h-3 w-3 mr-1" />
                      {format(new Date(obs.observationDate), "MMM d, yyyy")}
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {obs.description}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t">
                    <div className="text-sm">
                      <span className="font-medium">{obs.childName}</span>
                      <span className="text-muted-foreground mx-1">•</span>
                      <span className="text-muted-foreground text-xs">By {obs.staffName}</span>
                    </div>
                    
                    {obs.outcomeIds && obs.outcomeIds.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {obs.outcomeIds.map(oid => (
                          <Badge key={oid} variant="outline" className="bg-primary/5 text-primary text-xs border-primary/20">
                            Outcome {oid}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}