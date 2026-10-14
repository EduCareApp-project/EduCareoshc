import type { ReactNode } from "react";
import { Bell, CheckCheck, Check, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  getListNotificationsQueryKey, getGetNotificationCountQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** All notification categories share the staff inbox; medical alerts use live records. */
export function StaffNotificationsTile({ medicalAlerts }: { medicalAlerts?: ReactNode }) {
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
    title: "Could not mark notifications as read",
    description: "Please try again.",
    variant: "destructive",
  });
  const mark = useMarkNotificationRead({ mutation: { onSettled: refresh, onError: failure } });
  const markAll = useMarkAllNotificationsRead({ mutation: { onSettled: refresh, onError: failure } });
  // Monthly medication inbox records can outlive a renewal. Live alerts below
  // replace these records, so a renewed medication doesn't leave a stale duplicate.
  const notifications = (query.data ?? []).filter((n) => n.type !== "medication_expiry");
  const unread = notifications.some((n) => !n.read);
  const busy = mark.isPending || markAll.isPending;

  return (
    <Card className="flex h-80 min-h-[13rem] flex-col" data-testid="staff-notifications-tile">
      <CardHeader className="shrink-0 pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications</span>
          {unread && <Button size="sm" variant="ghost" disabled={busy} onClick={() => markAll.mutate(undefined)} className="h-7 gap-1 text-xs font-normal">
            {markAll.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />} Mark all read
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
                {n.href ? <Link href={n.href} onClick={() => { if (!n.read && !busy) mark.mutate({ id: n.id }); }} className="block text-sm font-medium hover:underline break-words">{n.title}</Link>
                  : <p className="text-sm font-medium break-words">{n.title}</p>}
                {n.body && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{n.body}</p>}
              </div>
              {!n.read && <Button aria-label={`Mark ${n.title} as read`} variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={busy} onClick={() => mark.mutate({ id: n.id })}><Check className="h-3.5 w-3.5" /></Button>}
            </li>
          ))}
        </ul>}
      </CardContent>
    </Card>
  );
}
