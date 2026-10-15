import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganisationCalendar } from "./organisation-calendar";
import { fmtMelb } from "@/lib/timezone";

// Keep this focused on day selection; event form behaviour has separate tests.
vi.mock("./organisation-calendar-event-dialog", () => ({
  OrganisationCalendarEventDialog: ({ open, defaultDate, event, onOpenChange }: any) =>
    open ? <div role="dialog" aria-label="Event form"><span>{event?.title ?? defaultDate}</span><button onClick={() => onOpenChange(false)}>Close form</button></div> : null,
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup() {
  const today = fmtMelb(new Date(), "yyyy-MM-dd");
  const event = {
    id: 91, title: "Team meeting", startDate: today, endDate: today, startTime: "10:00",
    endTime: "11:00", location: "Staff room", description: "Review the program", canEdit: true,
  };
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify([event]), {
    status: 200, headers: { "Content-Type": "application/json" },
  }))));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><OrganisationCalendar /></QueryClientProvider>);
  return { today, client };
}

describe("calendar inline day events", () => {
  it("shows the selected day's full events below the month grid without opening a dialog", async () => {
    const { today } = setup();
    const day = await screen.findByTestId(`button-org-calendar-day-${today}`);
    fireEvent.click(day);
    const panel = screen.getByRole("region", { name: "Selected day events" });
    expect(within(panel).getByRole("heading", { level: 3 })).toBeVisible();
    expect(within(panel).getByText("Team meeting")).toBeVisible();
    expect(within(panel).getByText("Staff room")).toBeVisible();
    expect(within(panel).getByText("Review the program")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(day).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("grid").compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("switches dates and displays an inline empty day, retaining the add-event form", async () => {
    const { today } = setup();
    fireEvent.click(await screen.findByTestId(`button-org-calendar-day-${today}`));
    const anotherDay = screen.getAllByTestId(/button-org-calendar-day-/).find((button) => button.getAttribute("data-testid") !== `button-org-calendar-day-${today}`)!;
    const selectedDate = anotherDay.getAttribute("data-testid")!.replace("button-org-calendar-day-", "");
    fireEvent.click(anotherDay);
    const panel = screen.getByRole("region", { name: "Selected day events" });
    expect(within(panel).getByText("No events on this day.")).toBeVisible();
    expect(within(panel).queryByText("Team meeting")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Add event" }));
    expect(screen.getByRole("dialog", { name: "Event form" })).toHaveTextContent(selectedDate);
    fireEvent.click(screen.getByRole("button", { name: "Close form" }));
    expect(screen.getByRole("region", { name: "Selected day events" })).toBeVisible();
  });

  it("keeps edit controls working inline and clears the selected day when changing month", async () => {
    const { today, client } = setup();
    fireEvent.click(await screen.findByTestId(`button-org-calendar-day-${today}`));
    fireEvent.click(screen.getByRole("button", { name: "Edit Team meeting" }));
    expect(screen.getByRole("dialog", { name: "Event form" })).toHaveTextContent("Team meeting");
    fireEvent.click(screen.getByRole("button", { name: "Close form" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole("region", { name: "Selected day events" })).not.toBeInTheDocument();
  });
});
