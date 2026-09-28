import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import Excursions from "./excursions";

const createMutate = vi.fn();
const updateMutate = vi.fn();
const sendMutate = vi.fn();
const verifyMutate = vi.fn();
const removeNotificationMutate = vi.fn();
const restoreNotificationMutate = vi.fn();
const mockApi = vi.hoisted(() => ({
  excursions: [] as any[],
  detail: undefined as any,
}));

vi.mock("@workspace/api-client-react", () => ({
  useListExcursions: () => ({ data: mockApi.excursions, isLoading: false }),
  useCreateExcursion: () => ({ mutate: createMutate, isPending: false }),
  useUpdateExcursion: () => ({ mutate: updateMutate, isPending: false }),
  useGetExcursion: (id: number) => useQuery({
    queryKey: ["/api/excursions", id],
    queryFn: async () => mockApi.detail,
    initialData: mockApi.detail,
    enabled: false,
  }),
  useVerifyExcursionRecipients: () => ({ mutate: verifyMutate, isPending: false }),
  useAddExcursionRecipients: () => ({ mutate: vi.fn(), isPending: false }),
  useSendExcursion: () => ({ mutate: sendMutate, isPending: false }),
  useSendExcursionReminder: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveExcursionRecipient: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveExcursionRecipientNotification: () => ({ mutate: removeNotificationMutate, isPending: false }),
  useRestoreExcursionRecipientNotification: () => ({ mutate: restoreNotificationMutate, isPending: false }),
  useArchiveExcursion: () => ({ mutate: vi.fn(), isPending: false }),
  useListSites: () => ({ data: [{ id: 3, name: "Test Site" }] }),
  useRequestExcursionRiskAssessmentUploadUrl: () => ({ mutateAsync: vi.fn() }),
  getListExcursionsQueryKey: () => ["/api/excursions"],
  getGetExcursionQueryKey: (id: number) => ["/api/excursions", id],
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ isFullAccess: false, ownSiteId: 3 }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const expectedFields = {
  siteId: 3,
  heading: "Museum Discovery Day",
  excursionDate: "2026-11-18",
  description: "Internal activity notes",
  venue: "City Museum",
  purpose: "Explore local history",
  cost: "$12.75",
  departureTime: "08:10 AM",
  arrivalAtVenue: "09:05 AM",
  departureFromVenue: "01:35 PM",
  arrivalTime: "02:30 PM",
  transportMethod: "Chartered coach",
  restraintsFitted: "Lap-sash belts",
  childToStaffRatio: "1:7",
  staffAttending: "Alex, Blair, Casey",
  otherInformation: "Wear service uniform",
  itemsToBring: "Hat, lunch and water",
  medicalAuthorisationText: "Custom emergency medical authorisation",
};

const existingFields = {
  siteId: 3,
  heading: "Existing Zoo Visit",
  excursionDate: "2026-10-02T00:00:00.000Z",
  description: "Existing internal notes",
  venue: "City Zoo",
  purpose: "Existing animal studies purpose",
  cost: "$9.50",
  departureTime: "08:30 AM",
  arrivalAtVenue: "09:20 AM",
  departureFromVenue: "01:20 PM",
  arrivalTime: "02:10 PM",
  maximumChildren: "24",
  transportMethod: "Service minibus",
  restraintsFitted: "Age-appropriate restraints",
  childToStaffRatio: "1:6",
  staffAttending: "Existing Educator, Existing Leader",
  otherInformation: "Existing guardian information",
  itemsToBring: "Existing hat and water",
  medicalAuthorisationText: "Existing medical authorisation",
};

const labelByField = {
  heading: "Heading",
  venue: "Venue",
  description: "Description of Activities",
  medicalAuthorisationText: "Medical Authorisation Clause",
  purpose: "Purpose of Activity",
  excursionDate: "Date:",
  cost: "Cost:",
  departureTime: "Time of Departure from School",
  arrivalAtVenue: "Time of arrival at Venue",
  departureFromVenue: "Time of Departure from Venue",
  arrivalTime: "Time of arrival at School",
  transportMethod: "Method of Transport",
  restraintsFitted: "Restraints fitted",
  childToStaffRatio: "Child to staff ratios",
  staffAttending: "Staff in attendance",
  otherInformation: "Other Information",
  itemsToBring: "Children will need to bring",
} as const;

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Excursions />
    </QueryClientProvider>,
  );
}

function inputForLabel(labelText: string): HTMLInputElement | HTMLTextAreaElement {
  const normalise = (value: string) => value.replace("*", "").replace(/:$/, "").trim();
  const label = screen.getAllByText((_content, element) =>
    element?.tagName.toLowerCase() === "label" &&
    normalise(element.textContent ?? "") === normalise(labelText),
  )[0];
  const field = label.parentElement?.querySelector("input, textarea");
  if (!field) throw new Error(`No form field found for ${labelText}`);
  return field as HTMLInputElement | HTMLTextAreaElement;
}

function fillEveryPermissionField() {
  fireEvent.change(inputForLabel("Heading"), { target: { value: expectedFields.heading } });
  fireEvent.change(inputForLabel("Venue"), { target: { value: expectedFields.venue } });
  fireEvent.change(inputForLabel("Description of Activities"), { target: { value: expectedFields.description } });
  fireEvent.change(inputForLabel("Medical Authorisation Clause"), { target: { value: expectedFields.medicalAuthorisationText } });
  fireEvent.change(inputForLabel("Purpose of Activity"), { target: { value: expectedFields.purpose } });
  fireEvent.change(inputForLabel("Date:"), { target: { value: expectedFields.excursionDate } });
  fireEvent.change(inputForLabel("Cost:"), { target: { value: expectedFields.cost } });
  fireEvent.change(inputForLabel("Time of Departure from School"), { target: { value: expectedFields.departureTime } });
  fireEvent.change(inputForLabel("Time of arrival at Venue"), { target: { value: expectedFields.arrivalAtVenue } });
  fireEvent.change(inputForLabel("Time of Departure from Venue"), { target: { value: expectedFields.departureFromVenue } });
  fireEvent.change(inputForLabel("Time of arrival at School"), { target: { value: expectedFields.arrivalTime } });
  fireEvent.change(inputForLabel("Method of Transport"), { target: { value: expectedFields.transportMethod } });
  fireEvent.change(inputForLabel("Restraints fitted"), { target: { value: expectedFields.restraintsFitted } });
  fireEvent.change(inputForLabel("Child to staff ratios"), { target: { value: expectedFields.childToStaffRatio } });
  fireEvent.change(inputForLabel("Staff in attendance"), { target: { value: expectedFields.staffAttending } });
  fireEvent.change(inputForLabel("Other Information"), { target: { value: expectedFields.otherInformation } });
  fireEvent.change(inputForLabel("Children will need to bring"), { target: { value: expectedFields.itemsToBring } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.excursions = [];
  mockApi.detail = undefined;
  createMutate.mockImplementation((_variables, options) => options?.onSuccess?.({ id: 41 }));
  verifyMutate.mockImplementation((_variables, options) =>
    options?.onSuccess?.([
      {
        email: "guardian@example.com",
        valid: true,
        guardianName: "Test Guardian",
        children: [{ childId: 5, childName: "Test Child", siteId: 3 }],
      },
    ]),
  );
  removeNotificationMutate.mockImplementation((_variables, options) => options?.onSuccess?.());
  restoreNotificationMutate.mockImplementation((_variables, options) => options?.onSuccess?.());
});

describe("excursion reminder removal and undo", () => {
  it("switches the action to Undo and back after both successful server mutations", async () => {
    mockApi.detail = {
      id: 52,
      ...existingFields,
      riskAssessmentPath: null,
      riskAssessmentName: null,
      status: "sent",
      createdByStaffId: 7,
      sentAt: "2026-09-01T00:00:00.000Z",
      completedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      recipients: [{
        id: 55, excursionId: 52, guardianEmail: "guardian@example.com",
        guardianNameSnapshot: "Test Guardian", childNameSnapshot: "Test Child",
        hiddenFromGuardianAt: null, decision: null, viewedAt: null, acknowledgedAt: null,
      }],
      logs: [],
    };
    mockApi.excursions = [mockApi.detail];
    renderPage();
    fireEvent.click(screen.getByTestId("card-excursion-52"));

    fireEvent.click(screen.getByRole("button", { name: "Remove reminder" }));
    expect(removeNotificationMutate).toHaveBeenCalledWith(
      { id: 52, recipientId: 55 }, expect.any(Object),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(restoreNotificationMutate).toHaveBeenCalledWith(
      { id: 52, recipientId: 55 }, expect.any(Object),
    );
    expect(await screen.findByRole("button", { name: "Remove reminder" })).toBeInTheDocument();
  });
});

describe("staff view of guardian permission responses", () => {
  it("shows the saved answers and signature for the selected child only", async () => {
    mockApi.detail = {
      id: 52,
      ...existingFields,
      riskAssessmentPath: null,
      riskAssessmentName: null,
      status: "sent",
      createdByStaffId: 7,
      sentAt: "2026-09-01T00:00:00.000Z",
      completedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      recipients: [
        {
          id: 55, excursionId: 52, guardianEmail: "guardian@example.com",
          guardianNameSnapshot: "First Guardian", childNameSnapshot: "First Child",
          hiddenFromGuardianAt: null, decision: "granted", viewedAt: null, acknowledgedAt: null,
        },
        {
          id: 56, excursionId: 52, guardianEmail: "another@example.com",
          guardianNameSnapshot: "Second Guardian", childNameSnapshot: "Second Child",
          hiddenFromGuardianAt: null, decision: "declined", viewedAt: null, acknowledgedAt: null,
        },
      ],
      logs: [
        {
          id: 1, excursionId: 52, recipientId: 56, guardianEmail: "another@example.com",
          event: "declined", createdAt: "2026-09-02T09:00:00.000Z",
          metadata: { guardianName: "Second Guardian", typedSignatureName: "Other Signer" },
        },
        {
          id: 2, excursionId: 52, recipientId: 55, guardianEmail: "guardian@example.com",
          event: "granted", createdAt: "2026-09-02T10:00:00.000Z",
          metadata: {
            guardianName: "First Guardian", relationship: "Mother", homePhone: "03 1234 5678",
            workPhone: null, mobilePhone: "0400 123 456", medicalAcknowledgement: true,
            typedSignatureName: "First Guardian",
            signatureDataUrl: "data:image/png;base64,aGVsbG8=",
            signedAt: "2026-09-02T10:00:00.000Z",
          },
        },
      ],
    };
    mockApi.excursions = [mockApi.detail];
    renderPage();
    fireEvent.click(screen.getByTestId("card-excursion-52"));

    const row = screen.getByText("First Child").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row!).getByRole("button", { name: "View response" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Permission response for First Child")).toBeInTheDocument();
    expect(within(dialog).getByText("Permission granted")).toBeInTheDocument();
    expect(within(dialog).getByText("Mother")).toBeInTheDocument();
    expect(within(dialog).getByText("03 1234 5678")).toBeInTheDocument();
    expect(within(dialog).getByText("0400 123 456")).toBeInTheDocument();
    expect(within(dialog).getByText("Acknowledged")).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "Signature of First Guardian" }))
      .toHaveAttribute("src", "data:image/png;base64,aGVsbG8=");
    expect(within(dialog).queryByText("Other Signer")).not.toBeInTheDocument();
  });
});

describe("excursion permission-form submission", () => {
  it("submits every paper-form field when staff save a draft", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("button-add-excursion"));
    fillEveryPermissionField();

    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(createMutate).toHaveBeenCalledWith(
      { data: expect.objectContaining(expectedFields) },
      expect.any(Object),
    );
  });

  it("submits every paper-form field before sending", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("button-add-excursion"));
    fillEveryPermissionField();
    fireEvent.change(inputForLabel("Paste guardian emails (one per line)"), {
      target: { value: "guardian@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify Emails" }));

    fireEvent.click(screen.getByRole("button", { name: "Save & Send Now" }));

    expect(createMutate).toHaveBeenCalledWith(
      { data: expect.objectContaining(expectedFields) },
      expect.any(Object),
    );
    expect(sendMutate).toHaveBeenCalledWith(
      { id: 41, data: undefined },
      expect.any(Object),
    );
  });

  it("loads every existing field and submits every edited value", () => {
    mockApi.detail = {
      id: 52,
      ...existingFields,
      riskAssessmentPath: null,
      riskAssessmentName: null,
      status: "draft",
      createdByStaffId: 7,
      sentAt: null,
      completedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      recipients: [],
      logs: [],
    };
    mockApi.excursions = [mockApi.detail];
    renderPage();

    fireEvent.click(screen.getByTestId("card-excursion-52"));
    fireEvent.click(screen.getByRole("button", { name: "Edit Draft" }));

    for (const [field, label] of Object.entries(labelByField)) {
      const expected = field === "excursionDate"
        ? existingFields.excursionDate.slice(0, 10)
        : existingFields[field as keyof typeof existingFields];
      expect(inputForLabel(label)).toHaveValue(expected);
    }

    fillEveryPermissionField();
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(updateMutate).toHaveBeenCalledWith(
      { id: 52, data: expect.objectContaining(expectedFields) },
      expect.any(Object),
    );
  });
});