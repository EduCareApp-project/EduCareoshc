import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LayoutGrid } from "./layout-grid";
import type { LayoutItem } from "@/lib/dashboard-layout";

const grid = vi.hoisted(() => ({ props: null as any }));
vi.mock("react-grid-layout", () => ({
  WidthProvider: (component: unknown) => component,
  Responsive: (props: any) => { grid.props = props; return <div>{props.children}</div>; },
}));
afterEach(cleanup);
const items: LayoutItem[] = [{ i: "recent-observations", x: 0, y: 0, w: 12, h: 11 }];
const widgets = { "recent-observations": { view: <div>Recent observations</div>, placeholder: "", collapsed: true } };

describe("personal widget collapse in shared dashboard layouts", () => {
  it("shrinks collapsed widgets in viewing mode and restores their saved size on expansion", () => {
    const { rerender } = render(<LayoutGrid items={items} widgets={widgets} editing={false} stacked={false} />);
    expect(grid.props.layouts.lg[0]).toMatchObject({ h: 2, minH: 2, maxH: 2 });
    expect(items[0].h).toBe(11);
    rerender(<LayoutGrid items={items} widgets={{ "recent-observations": { ...widgets["recent-observations"], collapsed: false } }} editing={false} stacked={false} />);
    expect(grid.props.layouts.lg[0].h).toBe(11);
    expect(grid.props.layouts.lg[0].maxH).toBeUndefined();
  });
  it("does not change the published/draft dimensions while editing a layout", () => {
    render(<LayoutGrid items={items} widgets={widgets} editing stacked={false} />);
    expect(grid.props.layouts.lg[0]).toMatchObject({ h: 11, minH: 4 });
    expect(grid.props.layouts.lg[0].maxH).toBeUndefined();
  });
});
