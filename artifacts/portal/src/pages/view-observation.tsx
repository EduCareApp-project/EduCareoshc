import { useGetObservation, useDeleteObservation, getListObservationsQueryKey } from "@workspace/api-client-react";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, User, Calendar, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ViewObservation() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: obs, isLoading } = useGetObservation(id, { query: { enabled: !!id } });
  const deleteObs = useDeleteObservation();

  const handleDelete = () => {
    deleteObs.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListObservationsQueryKey() });
          toast({ title: "Deleted", description: "Observation removed successfully" });
          setLocation("/observations");
        }
      }
    );
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[500px] w-full" /></div>;
  }

  if (!obs) {
    return <div>Observation not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Observation Details</h1>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this observation record. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start mb-2">
              <CardTitle className="text-2xl leading-tight">{obs.title}</CardTitle>
            </div>
            <div className="flex items-center text-sm text-muted-foreground gap-4">
              <span className="flex items-center"><Calendar className="h-4 w-4 mr-1"/> {format(new Date(obs.observationDate), "MMMM d, yyyy")}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div>
              <h3 className="font-semibold text-foreground border-b pb-2 mb-3">Observation Notes</h3>
              <div className="whitespace-pre-wrap text-foreground/90 text-sm leading-relaxed">
                {obs.description}
              </div>
            </div>

            {obs.learningExtension && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h3 className="font-semibold text-primary mb-2 text-sm uppercase tracking-wider">Learning Extension</h3>
                <div className="whitespace-pre-wrap text-foreground/90 text-sm">
                  {obs.learningExtension}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-foreground border-b pb-2 mb-3 text-sm uppercase tracking-wider">MTOP Outcomes Assessed</h3>
              <div className="flex flex-wrap gap-2">
                {obs.outcomeIds.map(oid => (
                  <Badge key={oid} variant="secondary" className="bg-accent text-accent-foreground text-sm py-1">
                    Outcome {oid}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1">Child</span>
                <Link href={`/children/${obs.childId}`}>
                  <div className="flex items-center gap-2 p-2 -mx-2 rounded-md hover:bg-accent cursor-pointer transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                      {obs.childName?.charAt(0) || <User className="h-4 w-4" />}
                    </div>
                    <span className="font-medium">{obs.childName}</span>
                  </div>
                </Link>
              </div>
              
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1">Educator</span>
                <div className="flex items-center gap-2 p-2 -mx-2">
                  <div className="h-8 w-8 rounded-full bg-secondary/20 text-secondary-foreground flex items-center justify-center font-bold text-xs">
                    {obs.staffName?.charAt(0) || <User className="h-4 w-4" />}
                  </div>
                  <span className="font-medium">{obs.staffName}</span>
                </div>
              </div>

              {obs.programName && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1">Linked Program</span>
                  <Link href="/programs">
                    <span className="font-medium text-primary hover:underline cursor-pointer">{obs.programName}</span>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}