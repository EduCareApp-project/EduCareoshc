import { type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SchoolReportSummary } from "@/hooks/use-schools";
import { SchoolSummaryReport } from "./school-summary-report";

const { previewPdf, mutate, toast } = vi.hoisted(() => ({
  previewPdf: vi.fn(), mutate: vi.fn(), toast: vi.fn(),
}));
vi.mock("@workspace/api-client-react", () => ({ previewSchoolReport: previewPdf }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/use-schools", () => {
  const hook = () => ({ mutate, isPending: false });
  return {
    useSaveSchoolReportObligations: hook, useFinalizeSchoolReportSummary: hook,
    useArchiveSchoolReportSummary: hook, useDeleteSchoolReportSummary: hook,
  };
});
vi.mock("recharts", () => {
  const wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return Object.fromEntries([
    "Bar", "BarChart", "CartesianGrid", "Cell", "Legend", "Line", "LineChart",
    "Pie", "PieChart", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis",
  ].map((name) => [name, wrapper]));
});

const report: SchoolReportSummary = {
  id: 7, siteId: 4, reportYear: 2026, frequency: "term", period: "1", periodLabel: "Term 1 2026",
  statistics: {
    periodLabel: "Term 1 2026", termNumbers: [1], holidayProgramApplies: false,
    dateRange: { start: "2026-01-26", end: "2026-04-03" },
    weekdayAverages: [], weeklyAverages: [], holidayWeekdayAverages: [], holidayWeeklyAverages: [],
  },
  reportingObligations: {
    learningPlayProgramHighlights: "Saved learning text", teamServiceLeadership: "",
    policyPracticeUpdates: "", childSafetyWellbeing: "", communityFeedbackResolution: "", focusForFuture: "",
  },
  status: "draft", finalizedAt: null, finalizedPdfPath: null, finalizedPdfName: null,
  finalizedPdfCreatedAt: null, archivedAt: null, createdAt: "2026-04-03", updatedAt: "2026-04-03",
};

describe("school-report PDF preview", () => {
  let popup: {
    closed: boolean; opener: unknown; document: { title: string; body: { textContent: string } };
    location: { replace: ReturnType<typeof vi.fn> }; close: ReturnType<typeof vi.fn>;
  };
  const createUrl = vi.fn();
  const revokeUrl = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    popup = {
      closed: false, opener: window, document: { title: "", body: { textContent: "" } },
      location: { replace: vi.fn() }, close: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    vi.spyOn(window, "setInterval").mockReturnValue(42 as unknown as ReturnType<typeof window.setInterval>);
    vi.spyOn(window, "clearInterval");
    createUrl.mockReturnValue("blob:http://localhost/report-preview");
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    });
    previewPdf.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
  });
  afterEach(() => {
    expect(mutate).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function mount(value = report) {
    return render(<SchoolSummaryReport siteId={4} report={value} canManageLifecycle />);
  }
  it("opens a new window synchronously, generates the PDF, and leaves the report unsaved", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(vi.mocked(window.open).mock.invocationCallOrder[0]).toBeLessThan(previewPdf.mock.invocationCallOrder[0]);
    expect(popup.opener).toBeNull();
    expect(previewPdf).toHaveBeenCalledWith(4, 7, { reportingObligations: report.reportingObligations });
    await waitFor(() => expect(popup.location.replace).toHaveBeenCalledWith("blob:http://localhost/report-preview"));
    expect(popup.close).not.toHaveBeenCalled();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
  it("includes current unsaved edits without requiring Save or enabling finalisation", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Learning, Play & Program Highlights"), { target: { value: "Unsaved new text" } });
    expect(screen.getByRole("button", { name: "Finalise report" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    await waitFor(() => expect(previewPdf).toHaveBeenCalledWith(4, 7, {
      reportingObligations: { ...report.reportingObligations, learningPlayProgramHighlights: "Unsaved new text" },
    }));
    expect(screen.getByLabelText("Learning, Play & Program Highlights")).toHaveValue("Unsaved new text");
    expect(screen.getByRole("button", { name: /^Save$/ })).not.toBeDisabled();
    expect(report.reportingObligations.learningPlayProgramHighlights).toBe("Saved learning text");
  });
  it("shows a loading state and disables repeated preview clicks", async () => {
    let resolve!: (value: Blob) => void;
    previewPdf.mockReturnValue(new Promise<Blob>((done) => { resolve = done; }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    expect(screen.getByRole("button", { name: "Generating preview…" })).toBeDisabled();
    expect(popup.document.body.textContent).toBe("Generating report preview…");
    await act(async () => resolve(new Blob(["%PDF"], { type: "application/pdf" })));
    expect(screen.getByRole("button", { name: "Preview PDF" })).not.toBeDisabled();
  });
  it("explains a blocked popup without generating or saving a report", () => {
    vi.mocked(window.open).mockReturnValue(null);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    expect(previewPdf).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Preview window blocked", variant: "destructive" }));
  });
  it("closes the temporary window on failure and preserves edits for retry", async () => {
    previewPdf.mockRejectedValueOnce(new Error("Logo unavailable"));
    mount();
    fireEvent.change(screen.getByLabelText("Learning, Play & Program Highlights"), { target: { value: "Keep these edits" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    await waitFor(() => expect(popup.close).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Unable to preview report", description: "Logo unavailable" }));
    expect(screen.getByLabelText("Learning, Play & Program Highlights")).toHaveValue("Keep these edits");
    expect(screen.getByRole("button", { name: "Preview PDF" })).not.toBeDisabled();
  });
  it("does not open a PDF if the user already closed the preview window", async () => {
    let resolve!: (value: Blob) => void;
    previewPdf.mockReturnValue(new Promise<Blob>((done) => { resolve = done; }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    popup.closed = true;
    await act(async () => resolve(new Blob(["%PDF"])));
    expect(createUrl).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Preview PDF" })).not.toBeDisabled();
  });
  it("keeps the PDF available until its window closes, then releases the blob", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    await waitFor(() => expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000));
    const timer = vi.mocked(window.setInterval).mock.calls.find(([, interval]) => interval === 1000)![0] as () => void;
    timer();
    expect(revokeUrl).not.toHaveBeenCalled();
    popup.closed = true;
    timer();
    expect(revokeUrl).toHaveBeenCalledWith("blob:http://localhost/report-preview");
    expect(window.clearInterval).toHaveBeenCalledWith(42);
  });
  it.each([
    { ...report, status: "finalized" as const },
    { ...report, archivedAt: "2026-04-05" },
  ])("does not show draft preview for a finalised or archived report", (value) => {
    mount(value);
    expect(screen.queryByRole("button", { name: "Preview PDF" })).not.toBeInTheDocument();
    expect(previewPdf).not.toHaveBeenCalled();
  });
});
