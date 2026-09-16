import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Excursions from "./excursions";

const createMutate = vi.fn();
const updateMutate = vi.fn();
const sendMutate = vi.fn();
const verifyMutate = vi.fn();
const mockApi = vi.hoisted(() => ({
  excursions: [] as any[],
  detail: undefined as any,
}));

vi.mock("@workspace/api-client-react", () => ({
  useListExcursions: () => ({ data: mockApi.excursions, isLoading: false }),
  useCreateExcursion: () => ({ mutate: createMutate, isPending: false }),
  useUpdateExcursion: () => ({ mutate: updateMutate, isPending: false }),
  useGetExcursion: () => ({ data: mockApi.detail, isLoading: false }),
  useVerifyExcursionRecipients: () => ({ mutate: verifyMutate, isPending: false }),
  useAddExcursionRecipients: () => ({ mutate: vi.fn(), isPending: false }),
  useSendExcursion: () => ({ mutate: sendMutate, isPending: false }),
  useSendExcursionReminder: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveExcursionRecipient: () => ({ mutate: vi.fn(), isPending: false }),
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
  description: "Description of Activities (Internal Info)",
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
  fireEvent.change(inputForLabel("Description of Activities (Internal Info)"), { target: { value: expectedFields.description } });
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