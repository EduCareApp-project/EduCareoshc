import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, MailOpen, Save, ShieldAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useGetFeatureSettings,
  getGetFeatureSettingsQueryKey,
  useUpdateFeatureSettings,
} from "@workspace/api-client-react";

export default function SettingsWebmailConfig() {
  const { isFullAccess } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetFeatureSettings({
    query: { queryKey: getGetFeatureSettingsQueryKey() },
  });
  const updateMutation = useUpdateFeatureSettings();

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("https://sh00070.cd.ds.network:2096/");

  useEffect(() => {
    if (!settings) return;
    setEnabled((settings as any).webmailEnabled ?? false);
    setUrl((settings as any).webmailUrl ?? "https://sh00070.cd.ds.network:2096/");
  }, [settings]);

  function handleSave() {
    if (enabled && !url.trim()) {
      toast({ title: "Please enter a webmail URL", variant: "destructive" });
      return;
    }
    updateMutation.mutate(
      { data: { webmailEnabled: enabled, webmailUrl: url.trim() } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeatureSettingsQueryKey() });
          toast({ title: "Webmail settings saved" });
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
          <MailOpen className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Webmail</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-xl bg-muted/30 animate-pulse" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webmail Link</CardTitle>
            <CardDescription>
              When enabled, a Webmail link appears in the sidebar for all staff. Use this to give quick access to your organisation's webmail login page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="webmail-enabled" className="flex flex-col gap-0.5">
                <span>Show Webmail link in sidebar</span>
                <span className="font-normal text-muted-foreground text-xs">Visible to all staff roles</span>
              </Label>
              <Switch
                id="webmail-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="webmail-url">Webmail URL</Label>
              <div className="flex gap-2">
                <Input
                  id="webmail-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://mail.yourprovider.com"
                  disabled={!enabled}
                  className="flex-1"
                />
                {url && enabled && (
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    title="Test link"
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Clicking the sidebar link opens this URL in a new tab.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
