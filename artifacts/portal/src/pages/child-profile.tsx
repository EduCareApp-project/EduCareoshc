import { useGetChild, useGetChildObservations } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, Edit, Plus, User, Phone, Mail, FileText, Calendar, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ChildProfile() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  
  const { data: child, isLoading } = useGetChild(id, { query: { enabled: !!id } });
  const { data: observations, isLoading: obsLoading } = useGetChildObservations(id, { query: { enabled: !!id } });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!child) {
    return <div>Child not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/children">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
              {child.firstName[0]}{child.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-none">{child.firstName} {child.lastName}</h1>
              <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize">{child.ageGroup.replace('_', ' ')}</Badge>
                <Badge variant={child.status === 'active' ? 'default' : 'secondary'} className="capitalize">{child.status}</Badge>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4"/> Date of Birth</div>
              <p className="font-medium">{format(new Date(child.dateOfBirth), "MMMM d, yyyy")}</p>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4"/> Enrolled Since</div>
              <p className="font-medium">{format(new Date(child.enrollmentDate), "MMMM d, yyyy")}</p>
            </div>
            
            <Separator />
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4"/> Guardian</div>
              <p className="font-medium">{child.guardianName}</p>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4"/> Phone</div>
              <p className="font-medium">{child.guardianPhone}</p>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4"/> Email</div>
              <p className="font-medium">{child.guardianEmail}</p>
            </div>

            {child.medicalNotes && (
              <>
                <Separator />
                <div className="space-y-1 bg-destructive/10 p-3 rounded-md border border-destructive/20 text-destructive">
                  <div className="text-sm font-semibold flex items-center gap-2">Medical Notes</div>
                  <p className="text-sm">{child.medicalNotes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5"/> Learning Observations</CardTitle>
            <Link href={`/observations/new?childId=${child.id}`}>
              <Button size="sm"><Plus className="h-4 w-4 mr-1"/> New Observation</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {obsLoading ? (
              <div className="space-y-3 mt-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : !observations || observations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No observations recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {observations.map((obs) => (
                  <Link key={obs.id} href={`/observations/${obs.id}`}>
                    <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium group-hover:text-primary transition-colors">{obs.title}</h4>
                        <span className="text-xs text-muted-foreground">{format(new Date(obs.observationDate), "MMM d, yyyy")}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{obs.description}</p>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {obs.outcomeIds.map(oid => (
                          <Badge key={oid} variant="outline" className="bg-primary/5 text-xs text-primary border-primary/20">
                            Outcome {oid}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}