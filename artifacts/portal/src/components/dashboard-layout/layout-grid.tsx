import { type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { WidthProvider, Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./dashboard-layout.css";
import { minSize, readingOrder, WIDGET_LABELS, type LayoutItem } from "@/lib/dashboard-layout";

const Grid = WidthProvider(Responsive);

export type WidgetDef = { view: ReactNode | null; placeholder: string };

export function LayoutGrid({ items, widgets, editing, stacked, disabled = false, onCommit }: {
  items: LayoutItem[]; widgets: Record<string, WidgetDef>; editing: boolean; stacked: boolean;
  disabled?: boolean;
  onCommit?: (items: LayoutItem[]) => void;
}) {
  const shown = items.filter((it) => editing || widgets[it.i]?.view != null);
  if (stacked) {
    return (
      <div className="space-y-4" data-testid="dashboard-layout-stacked">
        {readingOrder(shown).map((it) => (
          <div key={it.i} className="min-w-0" data-testid={`widget-${it.i}`}>{widgets[it.i]?.view ?? null}</div>
        ))}
      </div>
    );
  }
  const layout = shown.map((it) => ({ ...it, ...minSize(it.i), resizeHandles: ["s", "e", "se"] as ("s" | "e" | "se")[] }));
  const commit = (l: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
    if (!onCommit || disabled) return;
    const map = new Map(l.map((n) => [n.i, n]));
    onCommit(items.map((it) => { const n = map.get(it.i); return n ? { i: it.i, x: n.x, y: n.y, w: n.w, h: n.h } : it; }));
  };
  return (
    <div className={editing ? "dash-editing" : ""} data-testid="dashboard-layout-grid">
      <Grid
        className="layout"
        layouts={{ lg: layout, md: layout }}
        breakpoints={{ lg: 768, md: 0 }}
        cols={{ lg: 12, md: 12 }}
        rowHeight={36}
        margin={[12, 12]}
        compactType="vertical"
        isDraggable={editing && !disabled}
        isResizable={editing && !disabled}
        draggableHandle=".dash-drag-handle"
        onDragStop={commit}
        onResizeStop={commit}
      >
        {shown.map((it) => {
          const w = widgets[it.i];
          return (
            <div key={it.i} className="flex min-h-0 flex-col overflow-hidden rounded-lg" data-testid={`widget-${it.i}`}>
              {editing && (
                <div className="dash-drag-handle flex shrink-0 cursor-grab items-center gap-1.5 bg-primary px-2 py-1 text-xs font-medium text-primary-foreground active:cursor-grabbing" data-testid={`handle-${it.i}`}>
                  <GripVertical className="h-3.5 w-3.5" /> {WIDGET_LABELS[it.i] ?? it.i}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto [&>*]:min-h-full">
                {w?.view ?? (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">{w?.placeholder}</div>
                )}
              </div>
            </div>
          );
        })}
      </Grid>
    </div>
  );
}
