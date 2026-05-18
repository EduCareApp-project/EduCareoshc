import { useListPrograms } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Target, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function ProgramsList() {
  const { data: programs, isLoading } = useListPrograms();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'default';
      case 'planned': return 'secondary';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Educational Programs</h1>
          <p className="text-muted-foreground mt-1">Manage learning programs mapped to MTOP outcomes.</p>
        </div>
        <Link href="/programs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Program
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-48 bg-muted/20" />
            </Card>
          ))}
        </div>
      ) : programs?.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border border-dashed">
          <Layers className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-1">No programs found</h3>
          <p className="text-muted-foreground">Create your first educational program.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs?.map((program) => (
            <Card key={program.id} className="hover:border-primary/30 transition-all">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl mb-1">{program.title}</CardTitle>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(program.startDate), "MMM d, yyyy")}
                    {program.endDate ? ` - ${format(new Date(program.endDate), "MMM d, yyyy")}` : ' (Ongoing)'}
                  </div>
                </div>
                <Badge variant={getStatusColor(program.status) as any} className="capitalize">
                  {program.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">{program.description}</p>
                
                <div className="space-y-3">
                  {program.outcomeIds && program.outcomeIds.length > 0 && (
                    <div className="flex gap-2 items-start">
                      <span className="text-xs text-muted-foreground w-16 pt-0.5 flex items-center gap-1">
                        <Target className="h-3 w-3"/> MTOP:
                      </span>
                      <div className="flex flex-wrap gap-1 flex-1">
                        {program.outcomeIds.map(oid => (
                          <span key={oid} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                            Outcome {oid}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}