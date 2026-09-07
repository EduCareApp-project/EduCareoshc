import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Incidents from "./incidents";

const incident = {
  id: 42,
  childName: "Alex Taylor",
  createdAt: "2026-09-07T00:00:00.000Z",
  incidentDatetime: "2026-09-07T01:00:00.000Z",
  description: "Minor playground incident",
  attachmentPath: "/objects/incidents/42/report.pdf",
  archived: false,
  reportMadeAt: null,
  reportPersonId: null,
  regulatoryNotifyRequired: null,
  reviewNotes: null,
  checkInFamily: null,
};

vi.mock("@workspace/api-client-react", () => ({
  useListIncidents: () => ({ data: [incident], isLoading: false }),
  useCreateIncident: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateIncident: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteIncident: () => ({ mutate: vi.fn(), isPending: false }),
  useListChildren: () => ({ data: [] }),
  useListSites: () => ({ data: [] }),
  getListIncidentsQueryKey: () => ["/api/incidents"],
}));

vi.mock("@workspace/object-storage-web", () => ({
  useUpload: () => ({ uploadFile: vi.fn(), isUploading: false }),
}));

vi.mock("@/hooks/use-active-staff", () => ({
  useActiveStaff: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    canDelete: false,
    canEditAfterSubmit: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("incident attachments", () => {
  it("opens stored attachments through the API storage route", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Incidents />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByText("Alex Taylor"));

    expect(screen.getByRole("link", { name: /view file/i })).toHaveAttribute(
      "href",
      "/api/storage/objects/incidents/42/report.pdf",
    );
  });
});