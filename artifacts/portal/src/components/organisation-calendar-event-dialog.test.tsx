import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganisationCalendarEventDialog } from "./organisation-calendar-event-dialog";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function form() {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OrganisationCalendarEventDialog open onOpenChange={onOpenChange} event={null}
        defaultDate="2026-10-14" onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onSaved, onOpenChange };
}
describe("calendar save recovery", () => {
  it("settles a real generated mutation after HTTP failure, retains input and permits retry", async () => {
    const saved = { id: 91, organisationId: 1, siteId: null, title: "Recovery meeting",
      description: "", location: "", startDate: "2026-10-14", endDate: "2026-10-14",
      startTime: null, endTime: null, createdBy: 21, createdAt: "", updatedAt: "", canEdit: true };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Test save failed" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(saved), {
        status: 201, headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetcher);
    const { onSaved, onOpenChange } = form();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: saved.title } });
    fireEvent.click(screen.getByTestId("button-org-event-save"));
    expect(await screen.findByText("Test save failed")).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue(saved.title);
    await waitFor(() => expect(screen.getByTestId("button-org-event-save")).toBeEnabled());
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-org-event-save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects a blank title without submitting", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    form();
    fireEvent.click(screen.getByTestId("button-org-event-save"));
    expect(screen.getByText("Enter a title.")).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
