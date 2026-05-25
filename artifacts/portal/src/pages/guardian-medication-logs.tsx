import { useListGuardianMedicationLogs } from "@workspace/api-client-react";
import { Pill, Calendar, User, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { toMelbourneDate } from "@/lib/timezone";

function formatDT(iso: string) {
  try {
    return format(toMelbourneDate(iso), "dd/MM/yyyy 'at' h:mm a");
  } catch {
    return iso;
  }
}

export default function GuardianMedicationLogs() {
  const { data: logs, isLoading } = useListGuardianMedicationLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Pill className="h-6 w-6 text-muted-foreground" />
          Medication Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A record of all medications administered to your child at the centre.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mb-3 opacity-25" />
            <p className="font-medium">No medication records yet</p>
            <p className="text-sm mt-1">Records will appear here when a medication is administered at the centre.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="overflow-hidden">
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-4 w-4 text-blue-600" />
                      {log.medicationName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{log.childName}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDT(log.administeredAt)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-5 pb-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-2">
                  <div>
                    <span className="text-muted-foreground">Dosage</span>
                    <p className="font-medium">{log.dosageAdministered}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Method</span>
                    <p className="font-medium">{log.methodOfAdministration}</p>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2 mt-1 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>Administered by <span className="text-foreground font-medium">{log.administeredByName}</span></span>
                    {log.witnessName && (
                      <span className="ml-2">· Witnessed by <span className="text-foreground font-medium">{log.witnessName}</span></span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
