import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LayoutDashboard, Loader2, Save, Send, RotateCcw, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { normalizeItems, type DashboardKind } from "@/lib/dashboard-layout";
import { LayoutGrid, type WidgetDef } from "./layout-grid";
import { useLayoutEditor } from "./use-layout-editor";

type Confirm = "leave" | "apply" | "discard" | "reset" | "restart" | "exit" | null;

export type EditGuard = { current: boolean };

export function DashboardLayoutHost({ dashboard, widgets, defaultView, extra, guard }: {
  dashboard: DashboardKind; widgets: Record<string, WidgetDef>; defaultView: ReactNode; extra?: ReactNode; guard?: EditGuard;
}) {
  const { user } = useAuth();
  const mobile = useIsMobile();
  const ed = useLayoutEditor(dashboard, user?.id ?? null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const busy = ed.pending !== null;
  const guardRef = useRef(guard);
  guardRef.current = guard;
  useEffect(() => {
    if (guardRef.current) guardRef.current.current = ed.editing;
    return () => { if (guardRef.current) guardRef.current.current = false; };
  }, [ed.editing]);

  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const bypassRef = useRef(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = ed.editing && ed.dirty;
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bypassRef.current || !dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault(); e.stopPropagation();
      anchorRef.current = a;
      setConfirm("leave");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  const followLink = () => {
    const a = anchorRef.current; anchorRef.current = null; setConfirm(null);
    if (!a) return;
    bypassRef.current = true;
    try { a.click(); } finally { bypassRef.current = false; }
  };

  const { data, session } = ed;
  if (ed.query.isLoading) {
    return <div className="space-y-4" data-testid="skeleton-dashboard-layout"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  const loadError = ed.query.isError && !data ? (
    <Alert variant="destructive" className="mb-4" data-testid="status-layout-error">
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>The saved dashboard layout could not be loaded. Showing the standard layout.</span>
        <Button size="sm" variant="outline" onClick={() => ed.query.refetch()} disabled={ed.query.isFetching} data-testid="button-layout-retry">Retry</Button>
      </AlertDescription>
    </Alert>
  ) : null;

  const canEdit = !!data?.canEdit;
  const published = data?.published ?? null;
  const editingNow = canEdit && ed.editing && !!session;
  const stale = !!session && session.base !== (published?.revision ?? 0);
  const blocked = busy || !!session?.conflict;

  const items = editingNow ? session!.items : published ? normalizeItems(dashboard, published.items) : null;
  let body: ReactNode;
  if (items) {
    body = <><LayoutGrid items={items} widgets={widgets} editing={editingNow && !mobile} disabled={busy} stacked={mobile} onCommit={ed.setItems} />{!editingNow && extra ? <div className="mt-6">{extra}</div> : null}</>;
  } else body = defaultView;

  const onConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    if (c === "apply") await ed.apply();
    else if (c === "discard") await ed.discard();
    else if (c === "reset") ed.resetDefault();
    else if (c === "restart") await ed.restart();
  };

  const toolbar = !canEdit ? null : mobile && !editingNow ? (
    <p className="mb-3 text-xs text-muted-foreground" data-testid="text-layout-mobile-notice">Dashboard layout editing is available on screens at least 768px wide.</p>
  ) : editingNow ? (
    <div className="mb-4 space-y-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-3" data-testid="toolbar-layout-edit">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="gap-1"><LayoutDashboard className="h-3 w-3" /> Editing layout</Badge>
        <span className="text-xs text-muted-foreground">
          {session!.dirty ? "Unsaved changes" : session!.rev > 0 ? "Private draft saved" : "No draft saved yet"} . Only you see this until you apply it.
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={blocked || (!session!.dirty && session!.rev > 0)} onClick={() => void ed.save()} data-testid="button-layout-save">
            {ed.pending === "save" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save draft
          </Button>
          <Button size="sm" disabled={blocked || stale} onClick={() => setConfirm("apply")} data-testid="button-layout-apply">
            {ed.pending === "apply" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}Apply to everyone
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("reset")} data-testid="button-layout-reset"><RotateCcw className="mr-1 h-4 w-4" />Reset to default</Button>
          {session!.rev > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("discard")} data-testid="button-layout-discard"><Trash2 className="mr-1 h-4 w-4" />Discard draft</Button>}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => (session!.dirty ? setConfirm("exit") : ed.exit())} data-testid="button-layout-exit"><X className="mr-1 h-4 w-4" />Exit without applying</Button>
        </div>
      </div>
      {!mobile && <p className="text-xs text-muted-foreground">Drag a tile’s green header to move it. Drag its bottom or right edge to resize it.</p>}
      {session!.recovered && <Alert data-testid="status-layout-recovered"><AlertDescription>Recovered unsaved changes from this browser after your last visit. Save the draft to keep them.</AlertDescription></Alert>}
      {mobile && <p className="text-xs text-muted-foreground">Dragging and resizing need a wider screen. Your edits are kept.</p>}
      {(stale || session!.conflict) && (
        <Alert data-testid="status-layout-stale">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{session!.conflict ? "The layout changed elsewhere." : "Someone applied a newer layout since your draft began."} Your arrangement is kept until you choose to restart from the current layout.</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("restart")} data-testid="button-layout-restart">Restart from current</Button>
          </AlertDescription>
        </Alert>
      )}
      {ed.error && <Alert variant="destructive" role="alert" data-testid="status-layout-save-error"><AlertDescription>{ed.error}</AlertDescription></Alert>}
    </div>
  ) : (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2" data-testid="toolbar-layout-view">
      {data?.draft && <Badge variant="secondary" data-testid="badge-layout-draft">Private draft saved</Badge>}
      <Button size="sm" variant="outline" onClick={ed.enter} disabled={!data} data-testid="button-layout-edit"><LayoutDashboard className="mr-1 h-4 w-4" />Edit layout</Button>
    </div>
  );

  const texts: Record<Exclude<Confirm, null | "exit" | "leave">, [string, string, string]> = {
    apply: ["Apply this layout to everyone?", "Every educator and leader in the organisation will see this arrangement on their dashboard. Unsaved changes are saved to your draft first.", "Apply to everyone"],
    discard: ["Discard your saved draft?", "Your private saved draft is deleted and you leave edit mode. The applied layout is not affected.", "Discard draft"],
    reset: ["Reset to the default arrangement?", "The current arrangement in the editor is replaced by the default. Nothing is saved until you save the draft.", "Reset to default"],
    restart: ["Restart from the current layout?", "Your edited arrangement is replaced by the layout currently applied for everyone.", "Restart from current"],
  };
  const t = confirm && confirm !== "exit" && confirm !== "leave" ? texts[confirm] : null;

  return (
    <div data-testid={`dashboard-layout-${dashboard}`}>
      {loadError}
      {toolbar}
      {body}
      <AlertDialog open={!!t} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent data-testid="dialog-layout-confirm">
          <AlertDialogHeader><AlertDialogTitle>{t?.[0]}</AlertDialogTitle><AlertDialogDescription>{t?.[1]}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-layout-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirm()} data-testid="button-layout-confirm">{t?.[2]}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm === "leave"} onOpenChange={(o) => { if (!o) { anchorRef.current = null; setConfirm(null); } }}>
        <AlertDialogContent data-testid="dialog-layout-leave">
          <AlertDialogHeader><AlertDialogTitle>Leave with unsaved layout changes?</AlertDialogTitle><AlertDialogDescription>Your arrangement is not saved to the server. If you leave now, a copy is kept in this browser and offered next time you choose Edit layout.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-layout-leave-stay">Stay</AlertDialogCancel>
            <Button variant="outline" onClick={followLink} data-testid="button-layout-leave-go">Leave page</Button>
            <Button disabled={busy || !!session?.conflict} onClick={async () => { if (await ed.save()) followLink(); else setConfirm(null); }} data-testid="button-layout-leave-save">Save draft and leave</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm === "exit"} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent data-testid="dialog-layout-exit">
          <AlertDialogHeader><AlertDialogTitle>You have unsaved changes</AlertDialogTitle><AlertDialogDescription>Save them to your private draft, or leave without saving. Leaving does not apply anything to everyone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-layout-exit-keep">Keep editing</AlertDialogCancel>
            <Button variant="outline" onClick={() => { setConfirm(null); ed.exit(); }} data-testid="button-layout-exit-nosave">Exit without saving</Button>
            <Button disabled={busy || !!session?.conflict} onClick={async () => { setConfirm(null); if (await ed.save()) ed.exit(); }} data-testid="button-layout-exit-save">Save draft and exit</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

