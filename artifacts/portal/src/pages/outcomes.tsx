import { useListOutcomes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Outcomes() {
  const { data: outcomes, isLoading } = useListOutcomes();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MTOP Framework</h1>
        <p className="text-muted-foreground mt-1">My Time Our Place - 5 Learning Outcomes</p>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          [1,2,3,4,5].map(i => <Skeleton key={i} className="h-48 w-full" />)
        ) : (
          outcomes?.map(outcome => (
            <Card key={outcome.id} className="border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3">
                  <span className="bg-primary text-primary-foreground h-8 w-8 rounded-full flex items-center justify-center text-sm">
                    {outcome.number}
                  </span>
                  {outcome.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{outcome.description}</p>
                <div className="bg-accent/30 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 text-foreground/80">Key Elements:</h4>
                  <div className="space-y-1.5 text-sm">
                    {outcome.subOutcomes.map((sub, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <span className="shrink-0 font-semibold text-primary w-8 text-right leading-snug">
                          {outcome.number}.{idx + 1}
                        </span>
                        <span className="text-foreground/90 leading-snug">{sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}