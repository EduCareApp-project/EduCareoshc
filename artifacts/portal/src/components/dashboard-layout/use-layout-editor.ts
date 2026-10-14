import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardLayout, getGetDashboardLayoutQueryKey, useSaveDashboardLayoutDraft,
  useDiscardDashboardLayoutDraft, usePublishDashboardLayout,
  type DashboardLayoutState,
} from "@workspace/api-client-react";
import { clearRescue, readRescue, writeRescue } from "@/lib/layout-rescue";
import { DEFAULT_LAYOUTS, errStatus, normalizeItems, sameItems, type DashboardKind, type LayoutItem } from "@/lib/dashboard-layout";

export type Session = { items: LayoutItem[]; base: number; rev: number; dirty: boolean; ver: number; conflict: boolean; recovered: boolean };
export type Pending = "save" | "apply" | "discard" | "restart" | null;

export function useLayoutEditor(dashboard: DashboardKind, userId: number | null) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setEditing(false); setSession(null); setError(null); setPending(null);
  }, [dashboard, userId]);
  // Cache is scoped to the signed-in user so private drafts never leak between accounts.
  const queryKey = [...getGetDashboardLayoutQueryKey(dashboard), "user", userId];
  const query = useGetDashboardLayout(dashboard, {
    query: { queryKey, refetchInterval: editing ? false : 60000, refetchOnWindowFocus: !editing, enabled: userId != null } as never,
  });
  const data = query.data as DashboardLayoutState | undefined;
  const saveM = useSaveDashboardLayoutDraft();
  const discardM = useDiscardDashboardLayoutDraft();
  const publishM = usePublishDashboardLayout();

  const sessionRef = useRef(session); sessionRef.current = session;
  const pendingRef = useRef(pending); pendingRef.current = pending;

  const patchCache = useCallback((fn: (old: DashboardLayoutState) => DashboardLayoutState) => {
    qc.setQueryData(queryKey, (old: DashboardLayoutState | undefined) => (old ? fn(old) : old));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, dashboard, userId]);

  const failed = (e: unknown, fallback: string) => {
    if (errStatus(e) === 409) {
      setSession((s) => (s ? { ...s, conflict: true } : s));
      setError("This layout was changed elsewhere. Your arrangement is untouched. Restart from the current layout to continue.");
      void query.refetch();
    } else setError(fallback);
    return null;
  };

  const enter = useCallback(() => {
    if (!data?.canEdit) return;
    const src = data.draft
      ? { items: data.draft.items, base: data.draft.baseRevision, rev: data.draft.revision }
      : { items: data.published?.items ?? DEFAULT_LAYOUTS[dashboard], base: data.published?.revision ?? 0, rev: 0 };
    const rescue = readRescue(userId, dashboard);
    if (rescue) {
      setSession({ items: normalizeItems(dashboard, rescue.items), base: rescue.base, rev: rescue.rev, dirty: true, ver: 1, conflict: false, recovered: true });
    } else {
      const items = normalizeItems(dashboard, src.items);
      setSession({ items, base: src.base, rev: src.rev, dirty: !sameItems(items, src.items), ver: 0, conflict: false, recovered: false });
    }
    setError(null);
    setEditing(true);
  }, [data, dashboard, userId]);

  const exit = useCallback(() => { clearRescue(userId, dashboard); setEditing(false); setSession(null); setError(null); }, [userId, dashboard]);

  const setItems = useCallback((items: LayoutItem[]) => {
    setSession((s) => (s && !sameItems(s.items, items) ? { ...s, items, dirty: true, ver: s.ver + 1 } : s));
  }, []);

  const resetDefault = useCallback(() => {
    setSession((s) => (s ? { ...s, items: normalizeItems(dashboard, DEFAULT_LAYOUTS[dashboard]), dirty: true, ver: s.ver + 1 } : s));
  }, [dashboard]);

  const save = useCallback(async (): Promise<{ rev: number; base: number } | null> => {
    const s = sessionRef.current;
    if (!s || pendingRef.current) return null;
    setPending("save"); setError(null);
    try {
      const doc = await saveM.mutateAsync({ dashboard, data: { items: s.items, baseRevision: s.base, expectedDraftRevision: s.rev } });
      setSession((cur) => (cur ? { ...cur, rev: doc.revision, base: doc.baseRevision, dirty: cur.ver !== s.ver, conflict: false, recovered: cur.ver !== s.ver ? cur.recovered : false } : cur));
      if (sessionRef.current?.ver === s.ver) clearRescue(userId, dashboard);
      patchCache((old) => ({ ...old, draft: doc }));
      return { rev: doc.revision, base: doc.baseRevision };
    } catch (e) { return failed(e, "The draft could not be saved. Your arrangement is kept; try again."); }
    finally { setPending(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard, saveM.mutateAsync, patchCache]);

  const apply = useCallback(async (): Promise<boolean> => {
    const s = sessionRef.current;
    if (!s || pendingRef.current) return false;
    let r: { rev: number; base: number } | null = { rev: s.rev, base: s.base };
    if (s.dirty || s.rev < 1) { r = await save(); if (!r) return false; }
    setPending("apply"); setError(null);
    try {
      const state = await publishM.mutateAsync({ dashboard, data: { expectedRevision: r.base, expectedDraftRevision: r.rev } });
      qc.setQueryData(queryKey, state);
      clearRescue(userId, dashboard);
      setEditing(false); setSession(null);
      return true;
    } catch (e) { failed(e, "The layout could not be applied. Your arrangement is kept; try again."); return false; }
    finally { setPending(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard, publishM.mutateAsync, save, qc]);

  const discard = useCallback(async (): Promise<boolean> => {
    if (pendingRef.current) return false;
    setPending("discard"); setError(null);
    try {
      await discardM.mutateAsync({ dashboard });
      patchCache((old) => ({ ...old, draft: null }));
      clearRescue(userId, dashboard);
      setEditing(false); setSession(null);
      return true;
    } catch (e) { failed(e, "The draft could not be discarded. Try again."); return false; }
    finally { setPending(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard, discardM.mutateAsync, patchCache]);

  /** Explicit restart: current published layout, with the server's current draft revision so the next save is accepted. */
  const restart = useCallback(async () => {
    if (pendingRef.current) return;
    setPending("restart"); setError(null);
    try {
      const res = await query.refetch();
      const fresh = res.data as DashboardLayoutState | undefined;
      if (!fresh) { setError("The current layout could not be loaded. Try again."); return; }
      setSession({
        items: normalizeItems(dashboard, fresh.published?.items ?? DEFAULT_LAYOUTS[dashboard]),
        base: fresh.published?.revision ?? 0, rev: fresh.draft?.revision ?? 0, dirty: true, ver: (sessionRef.current?.ver ?? 0) + 1, conflict: false, recovered: false,
      });
    } finally { setPending(null); }
  }, [dashboard, query]);

  // Recovery copy of unsaved geometry; server draft stays the durable source.
  useEffect(() => {
    if (!editing || !session || userId == null) return;
    if (session.dirty) writeRescue({ userId, dashboard, items: session.items, base: session.base, rev: session.rev });
    else clearRescue(userId, dashboard);
  }, [editing, session, userId, dashboard]);

  // Server writes are explicit. Unsaved navigation uses the private recovery copy.
  const dirty = !!session?.dirty;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return { dirty, query, data, editing, session, pending, error, setError, enter, exit, setItems, resetDefault, save, apply, discard, restart };
}
