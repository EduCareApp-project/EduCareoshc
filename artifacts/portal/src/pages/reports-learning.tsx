import { useGetLearningStoriesReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BookMarked, AlertCircle } from "lucide-react";

export default function ReportsLearning() {
  const { data: report, isLoading } = useGetLearningStoriesReport();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold tracking-tight">Learning Stories</h1><p className="text-muted-foreground mt-1">Analysis of MTOP outcome coverage and observation distribution.</p></div>
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
      </div>
    );
  }

  const chartData = (report?.byOutcome ?? []).map((o) => ({ name: `Outcome ${o.outcomeNumber}`, count: o.count, title: o.outcomeTitle }));
  const maxObs = Math.max(...(report?.byChild ?? []).map((c) => c.observationCount), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Stories</h1>
        <p className="text-muted-foreground mt-1">Analysis of MTOP outcome coverage and observation distribution across children.</p>
      </div>

      {(report?.underRepresentedOutcomes ?? []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Outcomes needing more coverage</p>
            <p className="text-sm text-amber-700 mt-1">These MTOP outcomes are under-represented in your observations:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {report?.underRepresentedOutcomes.map((o) => (
                <Badge key={o.outcomeId} className="bg-amber-100 text-amber-800 border-amber-300">Outcome {o.outcomeNumber} ({o.count})</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">MTOP Outcome Coverage</CardTitle></CardHeader>
          <CardContent>
            {chartData.every((d) => d.count === 0) ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <BookMarked className="h-8 w-8" />
                <p>No observations linked to outcomes yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, _n, props) => [v, props.payload?.title || ""]} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Observations per Child</CardTitle></CardHeader>
          <CardContent>
            {(report?.byChild ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <p>No children enrolled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...(report?.byChild ?? [])].sort((a, b) => b.observationCount - a.observationCount).map((c) => (
                  <div key={c.childId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{c.childName}</span>
                      <span className="text-muted-foreground">{c.observationCount}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(c.observationCount / maxObs) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Outcome Detail</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {(report?.byOutcome ?? []).map((o) => (
              <div key={o.outcomeId} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Outcome {o.outcomeNumber}</p>
                  <p className="text-xs text-muted-foreground">{o.outcomeTitle}</p>
                </div>
                <Badge variant={o.count === 0 ? "destructive" : "secondary"}>{o.count} observations</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
