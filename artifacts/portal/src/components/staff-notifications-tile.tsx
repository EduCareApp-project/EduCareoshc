import type { ReactNode } from "react";
import { Bell, CheckCheck, Check, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  getListNotificationsQueryKey, getGetNotificationCountQueryKey,
  type Notification,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Personal, unacknowledged inbox, including server-synchronised expiry alerts. */
export function StaffNotificationsTile({ medicalAlerts, renderAction }: { medicalAlerts?: ReactNode; renderAction?: (notification: Notification) => ReactNode }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const { toast } = useToast();
  const listKey = getListNotificationsQueryKey();
  const query = useListNotifications({
    query: {
      queryKey: [...listKey, "staff", user?.id],
      enabled: user?.type === "staff",
      refetchInterval: 30_000,
      staleTime: 0,
    },
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: listKey });
    void client.invalidateQueries({ queryKey: getGetNotificationCountQueryKey() });
  };
  const failure = () => toast({
    title: "Could not acknowledge notifications",
    description: "Please try again.",
    variant: "destructive",
  });
  const mark = useMarkNotificationRead({ mutation: { onSettled: refresh, onError: failure } });
  const markAll = useMarkAllNotificationsRead({ mutation: { onSettled: refresh, onError: failure } });
  const notifications = (query.data ?? []).filter((n) => !n.read);
  const unread = notifications.some((n) => !n.read);
  const busy = mark.isPending || markAll.isPending;

  return (
    <Card className="flex h-80 min-h-[13rem] flex-col" data-testid="staff-notifications-tile">
      <CardHeader className="shrink-0 pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications</span>
          {unread && <Button size="sm" variant="ghost" disabled={busy} onClick={() => markAll.mutate(undefined)} className="h-7 gap-1 text-xs font-normal">
            {markAll.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />} Acknowledge all
          </Button>}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-3 overflow-auto">
        {medicalAlerts}
        {query.isLoading && <Skeleton className="h-12 w-full" />}
        {query.isError && <div role="alert" className="text-sm text-destructive">
          Notifications could not be loaded. <Button variant="link" size="sm" onClick={() => void query.refetch()}>Retry</Button>
        </div>}
        {notifications.length > 0 && <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className={`flex items-start gap-2 rounded-md border p-3 ${n.read ? "bg-muted/30" : "border-primary/20 bg-primary/5"}`}>
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              <div className="min-w-0 flex-1">
                {n.href ? <Link href={n.href} className="block text-sm font-medium hover:underline break-words">{n.title}</Link>
                  : <p className="text-sm font-medium break-words">{n.title}</p>}
                {n.body && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{n.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {!n.read && <Button aria-label={`Acknowledge ${n.title}`} variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={busy} onClick={() => mark.mutate({ id: n.id })}><Check className="h-3.5 w-3.5" /> Acknowledge</Button>}
                  {renderAction?.(n)}
                </div>
              </div>
            </li>
          ))}
        </ul>}
      </CardContent>
    </Card>
  );
}
