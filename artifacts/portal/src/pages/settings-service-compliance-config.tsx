import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, ShieldCheck, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useGetFeatureSettings,
  getGetFeatureSettingsQueryKey,
  useUpdateFeatureSettings,
} from "@workspace/api-client-react";

export default function SettingsServiceComplianceConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [reviewCycleDays, setReviewCycleDays] = useState("90");

  useEffect(() => {
    if (!settings) return;
    setReviewCycleDays(String(settings.complianceReviewCycleDays ?? 90));
  }, [settings]);

  function handleSave() {
    updateMutation.mutate(
      {
        data: {
          complianceReviewCycleDays: parseInt(reviewCycleDays) || 90,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Service Compliance settings saved" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  if (!isFullAccess) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">These settings are restricted to Admin and Educational Leader users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Service Compliance Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review Cycle</CardTitle>
          <CardDescription>How frequently each NQS area should be reviewed and updated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-12 bg-muted/30 rounded animate-pulse" />
          ) : (
            <>
              <Label htmlFor="review-days">Review cycle duration</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="review-days"
                  type="number"
                  min={7}
                  max={365}
                  value={reviewCycleDays}
                  onChange={e => setReviewCycleDays(e.target.value)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground">
                NQS compliance areas that haven't been reviewed within this window will be flagged as overdue.
                Common values: 90 days (quarterly), 180 days (semi-annual), 365 days (annual).
              </p>
            </>
          )}
          <div className="pt-2 flex justify-end border-t">
            <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
