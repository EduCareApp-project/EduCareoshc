import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Plus,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  Mail,
  ShieldAlert,
  X,
  Building2,
  Trash2,
  Calendar,
  Archive,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListExcursions,
  useCreateExcursion,
  useUpdateExcursion,
  useGetExcursion,
  useVerifyExcursionRecipients,
  useAddExcursionRecipients,
  useSendExcursion,
  useSendExcursionReminder,
  useRemoveExcursionRecipient,
  useArchiveExcursion,
  useListSites,
  getListExcursionsQueryKey,
  getGetExcursionQueryKey,
  useRequestExcursionRiskAssessmentUploadUrl,
  Excursion,
  ExcursionInput,
} from "@workspace/api-client-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";

export default function Excursions() {
  const [selectedExcursionId, setSelectedExcursionId] = useState<number | null>(null);
  const [editExcursionId, setEditExcursionId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Excursion | null>(null);

  if (editExcursionId !== null) {
    return (
      <ExcursionForm
        editId={editExcursionId}
        onBack={() => setEditExcursionId(null)}
        onSuccess={() => {
          setSelectedExcursionId(editExcursionId);
          setEditExcursionId(null);
        }}
      />
    );
  }

  if (selectedExcursionId !== null) {
    return (
      <ExcursionDetail
        excursionId={selectedExcursionId}
        onBack={() => setSelectedExcursionId(null)}
        onEdit={() => {
          setEditExcursionId(selectedExcursionId);
          setSelectedExcursionId(null);
        }}
      />
    );
  }

  if (isCreating || duplicateSource) {
    return (
      <ExcursionForm
        duplicateFrom={duplicateSource ?? undefined}
        onBack={() => {
          setIsCreating(false);
          setDuplicateSource(null);
        }}
        onSuccess={(id) => {
          setIsCreating(false);
          setDuplicateSource(null);
          setSelectedExcursionId(id);
        }}
      />
    );
  }

  return (
    <ExcursionsList
      onSelect={setSelectedExcursionId}
      onCreate={() => setIsCreating(true)}
      onDuplicate={setDuplicateSource}
    />
  );
}

// ── List View ─────────────────────────────────────────────────────────────
function ExcursionsList({
  onSelect,
  onCreate,
  onDuplicate,
}: {
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDuplicate: (excursion: Excursion) => void;
}) {
  const { data: excursions, isLoading } = useListExcursions();
  const { data: sites } = useListSites();
  const { isFullAccess, ownSiteId } = usePermissions();
  const archiveMut = useArchiveExcursion();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");

  const filteredExcursions = (excursions ?? [])
    .filter((e) => {
      if (!isFullAccess && ownSiteId && e.siteId !== ownSiteId) return false;
      if (siteFilter !== "all" && e.siteId !== parseInt(siteFilter))
        return false;
      return statusFilter === "archived"
        ? e.status === "archived"
        : e.status !== "archived";
    })
    .sort(
      (a, b) =>
        new Date(b.excursionDate).getTime() -
        new Date(a.excursionDate).getTime(),
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-foreground"
            data-testid="text-page-title"
          >
            Excursions
          </h1>
          <p
            className="text-muted-foreground mt-1 text-sm sm:text-base"
            data-testid="text-page-subtitle"
          >
            Plan outings, attach risk assessments, and manage guardian
            permissions.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Select
            value={statusFilter}
            onValueChange={(value: "active" | "archived") => setStatusFilter(value)}
          >
            <SelectTrigger className="w-[140px]" data-testid="select-excursion-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          {isFullAccess && sites && sites.length > 0 && (
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button data-testid="button-add-excursion" onClick={onCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Plan Excursion
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredExcursions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <MapPin className="h-10 w-10 mb-2 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No excursions found</p>
            <p className="text-sm">
              Click Plan Excursion to create your first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredExcursions.map((exc) => (
            <Card
              key={exc.id}
              className="cursor-pointer group hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
              onClick={() => onSelect(exc.id)}
              data-testid={`card-excursion-${exc.id}`}
            >
              <CardHeader className="pb-3 bg-muted/10 border-b">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div className="flex items-center gap-3">
                    {exc.status === "sent" && (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                        Sent
                      </Badge>
                    )}
                    {exc.status === "completed" && (
                      <Badge variant="secondary">Completed</Badge>
                    )}
                    {exc.status === "draft" && (
                      <Badge variant="outline">Draft</Badge>
                    )}
                    {exc.status === "archived" && (
                      <Badge variant="secondary">Archived</Badge>
                    )}

                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(exc.excursionDate).toLocaleDateString("en-AU")}
                    </span>
                    {isFullAccess && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 border-l pl-3">
                        <Building2 className="h-3.5 w-3.5" />
                        {(sites ?? []).find((s) => s.id === exc.siteId)?.name}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(exc);
                      }}
                      data-testid={`button-duplicate-excursion-${exc.id}`}
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      Duplicate
                    </Button>
                    {exc.status !== "archived" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={archiveMut.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!confirm(`Archive "${exc.heading}"?`)) return;
                          archiveMut.mutate(
                            { id: exc.id },
                            {
                              onSuccess: () => {
                                toast({ title: "Excursion archived" });
                                queryClient.invalidateQueries({
                                  queryKey: getListExcursionsQueryKey(),
                                });
                              },
                              onError: (error) => toast({
                                title: "Failed to archive excursion",
                                description: error.message,
                                variant: "destructive",
                              }),
                            },
                          );
                        }}
                        data-testid={`button-archive-excursion-${exc.id}`}
                      >
                        <Archive className="mr-1.5 h-4 w-4" />
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">
                  {exc.heading}
                </CardTitle>
                <CardDescription className="line-clamp-2 mt-1 text-sm leading-relaxed">
                  {exc.venue} • {exc.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Detail View ─────────────────────────────────────────────────────────────
function ExcursionDetail({
  excursionId,
  onBack,
  onEdit,
}: {
  excursionId: number;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { data: detail, isLoading } = useGetExcursion(excursionId, {
    query: {
      refetchInterval: 15000,
      queryKey: getGetExcursionQueryKey(excursionId),
    },
  });
  const [filter, setFilter] = useState("all");
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const sendReminder = useSendExcursionReminder();
  const sendMut = useSendExcursion();
  const removeMut = useRemoveExcursionRecipient();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!detail) return null;

  const filteredGuardians = detail.recipients.filter(
    (g) =>
      filter === "all" ||
      (filter === "pending" ? !g.decision : g.decision === filter),
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
            Sent
          </Badge>
        );
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleRemind = () => {
    sendReminder.mutate(
      { id: excursionId },
      {
        onSuccess: () => toast({ title: "Reminders sent successfully" }),
        onError: (e) =>
          toast({
            title: "Failed to send reminders",
            description: e.message,
            variant: "destructive",
          }),
      },
    );
  };

  const handleSendDraft = () => {
    sendMut.mutate(
      { id: excursionId, data: undefined as any },
      {
        onSuccess: () => {
          toast({ title: "Excursion sent successfully" });
          queryClient.invalidateQueries({
            queryKey: getGetExcursionQueryKey(excursionId),
          });
        },
        onError: (e) =>
          toast({
            title: "Failed to send excursion",
            description: e.message,
            variant: "destructive",
          }),
      }
    );
  };

  const handleRemoveRecipient = (recipientId: number) => {
    if (!confirm("Remove this recipient?")) return;
    removeMut.mutate(
      { id: excursionId, recipientId },
      {
        onSuccess: () => {
          toast({ title: "Recipient removed" });
          queryClient.invalidateQueries({
            queryKey: getGetExcursionQueryKey(excursionId),
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-3 text-muted-foreground hover:text-foreground"
        data-testid="button-back-excursions"
      >
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Excursions
      </Button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {getStatusBadge(detail.status)}
          </div>
          <h2
            className="text-3xl font-bold tracking-tight text-foreground"
            data-testid={`text-excursion-title-${detail.id}`}
          >
            {detail.heading}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {detail.venue}
            </span>
            <span className="hidden sm:inline">&bull;</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />{" "}
              {new Date(detail.excursionDate).toLocaleDateString("en-AU")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {detail.status === "draft" && (
            <>
              <Button variant="outline" onClick={onEdit}>
                Edit Draft
              </Button>
              <Button onClick={handleSendDraft} disabled={sendMut.isPending}>
                {sendMut.isPending ? "Sending..." : "Send Excursion"}
              </Button>
            </>
          )}
          {detail.status === "sent" && isAdmin && (
            <Button variant="outline" onClick={onEdit} data-testid="button-edit-published-excursion">
              Edit Excursion
            </Button>
          )}
          {detail.riskAssessmentPath && (
            <Button
              variant="outline"
              asChild
              data-testid="button-view-risk-assessment"
            >
              <a
                href={`/api/excursions/${detail.id}/risk-assessment`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ShieldAlert className="h-4 w-4 mr-2 text-amber-500" /> Risk
                Assessment
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-lg bg-muted/30 border border-muted/50 whitespace-pre-wrap">
        <p
          className="text-foreground leading-relaxed text-sm"
          data-testid="text-excursion-description"
        >
          {detail.description}
        </p>
      </div>

      <div className="pt-2">
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <section className="p-5 sm:p-6" data-testid="section-logistics-details">
            <div className="border-b pb-4 mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Excursion information
              </p>
              <h2 className="mt-1 text-xl font-semibold">Permission Form</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The practical information provided to families with the permission form.
              </p>
            </div>

            <Card className="shadow-none rounded-sm border-2 overflow-hidden">
              <div className="bg-[#4a89d6] text-white py-3 px-4">
                <h3 className="text-center text-lg font-bold">{detail.heading}</h3>
              </div>
              <CardContent className="p-6 text-sm text-foreground grid gap-y-5">
                {detail.riskAssessmentPath && (
                  <div
                    className="flex flex-col gap-3 rounded-md border-2 border-emerald-700 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    data-testid="saved-form-risk-assessment"
                  >
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      <div>
                        <div className="font-bold text-emerald-800">Risk Assessment PDF</div>
                        <div className="mt-0.5 text-sm text-emerald-950">
                          {detail.riskAssessmentName || "Risk assessment attached"}
                        </div>
                      </div>
                    </div>
                    <Button
                      className="bg-emerald-700 text-white hover:bg-emerald-800"
                      asChild
                      data-testid="button-view-saved-form-risk-assessment"
                    >
                      <a
                        href={`/api/excursions/${detail.id}/risk-assessment`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Risk Assessment PDF
                      </a>
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Purpose of Activity:</div>
                  <div className="whitespace-pre-wrap text-[#4a89d6]">{detail.purpose}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Date:</div>
                  <div className="text-[#4a89d6]">{new Date(detail.excursionDate).toLocaleDateString("en-AU")}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Cost:</div>
                  <div className="text-[#4a89d6]">{detail.cost}</div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 mt-1">
                  <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                    <div className="font-bold">Time of Departure from School:</div>
                    <div className="text-[#4a89d6]">{detail.departureTime}</div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-1">
                    <div className="font-bold">Time of arrival at Venue:</div>
                    <div className="text-[#4a89d6]">{detail.arrivalAtVenue}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
                  <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                    <div className="font-bold">Time of Departure from Venue:</div>
                    <div className="text-[#4a89d6]">{detail.departureFromVenue}</div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-1">
                    <div className="font-bold">Time of arrival at School:</div>
                    <div className="text-[#4a89d6]">{detail.arrivalTime}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1 mt-1">
                  <div className="font-bold">Method of Transport:</div>
                  <div className="whitespace-pre-wrap text-[#4a89d6]">{detail.transportMethod}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Restraints fitted:</div>
                  <div className="text-[#4a89d6]">{detail.restraintsFitted}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Child to staff ratios:</div>
                  <div className="whitespace-pre-wrap text-[#4a89d6]">{detail.childToStaffRatio}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
                  <div className="font-bold">Staff in attendance:</div>
                  <div className="whitespace-pre-wrap text-[#4a89d6]">{detail.staffAttending}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1 mt-1">
                  <div className="font-bold">Other Information:</div>
                  <div className="whitespace-pre-wrap text-[#4a89d6]">{detail.otherInformation}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1 mt-1">
                  <div className="font-bold">Children will need to bring:</div>
                  <div className="whitespace-pre-wrap text-[#4a89d6]">{detail.itemsToBring}</div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="border-t" data-testid="section-activity-log">
            <button
              type="button"
              onClick={() => setActivityLogOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/30 sm:p-6"
              aria-expanded={activityLogOpen}
              data-testid="button-toggle-activity-log"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Record history
                </p>
                <h2 className="mt-1 text-xl font-semibold">Activity Log</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.logs.length} {detail.logs.length === 1 ? "entry" : "entries"} recorded
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                  activityLogOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {activityLogOpen && (
              <div className="border-t p-5 sm:p-6">
                <Card className="shadow-none">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {detail.logs.map((log) => (
                        <div key={log.id} className="flex gap-4 items-start text-sm">
                          <div className="w-32 shrink-0 text-muted-foreground text-xs pt-0.5">
                            {new Date(log.createdAt).toLocaleString("en-AU", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                          <div>
                            <span className="font-medium">{log.event}</span>
                            {log.guardianEmail && (
                              <span className="text-muted-foreground ml-2">
                                ({log.guardianEmail})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {detail.logs.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No activity recorded yet.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

          <section className="border-t p-5 sm:p-6 space-y-4" data-testid="section-guardian-permissions">
            <div className="border-b pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Permission responses
              </p>
              <h2 className="mt-1 text-xl font-semibold">Guardian Permissions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review each child&apos;s permission status and follow up with guardians who have not responded.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  variant={filter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="h-9"
                >
                  All
                </Button>
                <Button
                  variant={filter === "pending" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("pending")}
                  className="h-9"
                >
                  Waiting
                </Button>
                <Button
                  variant={filter === "granted" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("granted")}
                  className="h-9"
                >
                  Granted
                </Button>
              </div>

              <div className="flex gap-2">
                {detail.status === "sent" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemind()}
                    disabled={sendReminder.isPending}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendReminder.isPending ? "Sending..." : "Remind Pending"}
                  </Button>
                )}
                {detail.status !== "completed" && (
                  <AddRecipientsDialog
                    excursionId={detail.id}
                    siteId={detail.siteId}
                  />
                )}
              </div>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Guardian Email</TableHead>
                    <TableHead>Child</TableHead>
                    <TableHead>Viewed / Acknowledged</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuardians.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-muted-foreground"
                      >
                        No recipients match this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGuardians.map((g) => (
                      <TableRow key={g.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium text-sm">
                            {g.guardianNameSnapshot || "Guardian"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {g.guardianEmail}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-muted-foreground text-sm">
                          {g.childNameSnapshot}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {g.viewedAt ? (
                              <div>
                                Viewed:{" "}
                                {new Date(g.viewedAt).toLocaleDateString()}
                              </div>
                            ) : (
                              <div>Not viewed</div>
                            )}
                            {g.acknowledgedAt && (
                              <div>
                                Ack'd:{" "}
                                {new Date(
                                  g.acknowledgedAt,
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {g.decision === "granted" && (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                              Granted
                            </Badge>
                          )}
                          {g.decision === "declined" && (
                            <Badge variant="destructive">Declined</Badge>
                          )}
                          {!g.decision && (
                            <Badge
                              variant="secondary"
                              className="text-muted-foreground font-normal"
                            >
                              Waiting
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {detail.status === "draft" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Remove Recipient" onClick={() => handleRemoveRecipient(g.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </section></div>
      </div>
    </div>
  );
}

// ── Add Recipients Dialog ───────────────────────────────────────────────────
function AddRecipientsDialog({
  excursionId,
  siteId,
}: {
  excursionId: number;
  siteId: number;
}) {
  const [open, setOpen] = useState(false);
  const [emailsRaw, setEmailsRaw] = useState("");
  const [verifiedList, setVerifiedList] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const verifyMut = useVerifyExcursionRecipients();
  const addMut = useAddExcursionRecipients();

  const handleVerify = () => {
    const emails = emailsRaw
      .split("\n")
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    verifyMut.mutate(
      { data: { siteId, emails } },
      {
        onSuccess: (data) => setVerifiedList(data),
      },
    );
  };

  const handleRemove = (email: string) => {
    setVerifiedList((prev) => prev.filter((v) => v.email !== email));
  };

  const handleAdd = () => {
    const validEmails = verifiedList.filter((v) => v.valid).map((v) => v.email);
    if (validEmails.length === 0) return;
    addMut.mutate(
      { id: excursionId, data: { recipientEmails: validEmails } },
      {
        onSuccess: () => {
          toast({ title: "Recipients added" });
          queryClient.invalidateQueries({
            queryKey: getGetExcursionQueryKey(excursionId),
          });
          setOpen(false);
          setEmailsRaw("");
          setVerifiedList([]);
        },
        onError: (e) =>
          toast({
            title: "Failed to add",
            description: e.message,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="shrink-0 bg-white dark:bg-transparent"
        >
          <Mail className="h-4 w-4 mr-2" /> Add Recipients
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Recipients</DialogTitle>
          <DialogDescription>
            Paste emails one per line, then verify them against the site's
            guardians.
          </DialogDescription>
        </DialogHeader>

        {verifiedList.length === 0 ? (
          <div className="space-y-4">
            <Textarea
              placeholder="guardian@example.com&#10;another@example.com"
              value={emailsRaw}
              onChange={(e) => setEmailsRaw(e.target.value)}
              className="h-40"
            />
            <Button
              onClick={handleVerify}
              disabled={verifyMut.isPending || !emailsRaw.trim()}
            >
              {verifyMut.isPending ? "Verifying..." : "Verify Emails"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              {verifiedList.map((v, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border text-sm ${v.valid ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {v.email}
                      {v.valid ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    {v.valid ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        {v.guardianName} • Children:{" "}
                        {v.children.map((c: any) => c.childName).join(", ")}
                      </div>
                    ) : (
                      <div className="text-xs text-red-600 mt-1">
                        No active guardian portal account or linked active child found
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemove(v.email)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setVerifiedList([])}>
                Back to Edit
              </Button>
              <Button
                onClick={handleAdd}
                disabled={
                  addMut.isPending || !verifiedList.some((v) => v.valid)
                }
              >
                Add {verifiedList.filter((v) => v.valid).length} Valid
                Recipients
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Create Form ────────────────────────────────────────────────────────────
function ExcursionForm({
  editId,
  duplicateFrom,
  onBack,
  onSuccess,
}: {
  editId?: number;
  duplicateFrom?: Excursion;
  onBack: () => void;
  onSuccess: (id: number) => void;
}) {
  const { data: sites } = useListSites();
  const { isFullAccess, ownSiteId } = usePermissions();
  const { toast } = useToast();
  const [isUploadingRiskAssessment, setIsUploadingRiskAssessment] = useState(false);
  const requestUploadMut = useRequestExcursionRiskAssessmentUploadUrl();
  const queryClient = useQueryClient();

  const { data: editData } = useGetExcursion(editId as number, { query: { enabled: !!editId, queryKey: getGetExcursionQueryKey(editId as number) }});

  const createMut = useCreateExcursion();
  const updateMut = useUpdateExcursion();
  const sendMut = useSendExcursion();
  const verifyMut = useVerifyExcursionRecipients();

  const [formData, setFormData] = useState<Partial<ExcursionInput>>({
    siteId: !isFullAccess && ownSiteId ? ownSiteId : undefined,
    excursionDate: new Date().toISOString().split("T")[0],
    heading: "",
    description: "",
    venue: "",
    purpose: "",
    cost: "Free",
    departureTime: "09:00 AM",
    arrivalAtVenue: "09:30 AM",
    departureFromVenue: "01:30 PM",
    arrivalTime: "02:00 PM",
    transportMethod: "Walking",
    restraintsFitted: "N/A",
    childToStaffRatio: "1:8",
    maximumChildren: "",
    staffAttending: "",
    otherInformation: "",
    itemsToBring: "Hat, drink bottle, sensible shoes",
    medicalAuthorisationText:
      "In the event of an emergency, illness, or accident concerning my child, and if the nominated contact people cannot be reached, I authorise the educator/person in charge to consent to my child receiving medical, dental, or surgical treatment as deemed necessary by a medical practitioner or hospital.",
  });

  // Only init once
  const initialized = useRef(false);
  useEffect(() => {
    if (editData && !initialized.current) {
      initialized.current = true;
      setFormData({
        siteId: editData.siteId,
        excursionDate: new Date(editData.excursionDate).toISOString().split("T")[0],
        heading: editData.heading,
        description: editData.description,
        venue: editData.venue,
        purpose: editData.purpose,
        cost: editData.cost,
        departureTime: editData.departureTime,
        arrivalAtVenue: editData.arrivalAtVenue,
        departureFromVenue: editData.departureFromVenue,
        arrivalTime: editData.arrivalTime,
        transportMethod: editData.transportMethod,
        restraintsFitted: editData.restraintsFitted,
        childToStaffRatio: editData.childToStaffRatio,
        maximumChildren: editData.maximumChildren,
        staffAttending: editData.staffAttending,
        otherInformation: editData.otherInformation,
        itemsToBring: editData.itemsToBring,
        medicalAuthorisationText: editData.medicalAuthorisationText,
        riskAssessmentPath: editData.riskAssessmentPath || undefined,
        riskAssessmentName: editData.riskAssessmentName || undefined,
      });
    }
  }, [editData]);

  useEffect(() => {
    if (duplicateFrom && !initialized.current) {
      initialized.current = true;
      setFormData({
        siteId: duplicateFrom.siteId,
        excursionDate: new Date(duplicateFrom.excursionDate).toISOString().split("T")[0],
        heading: duplicateFrom.heading,
        description: duplicateFrom.description,
        venue: duplicateFrom.venue,
        purpose: duplicateFrom.purpose,
        cost: duplicateFrom.cost,
        departureTime: duplicateFrom.departureTime,
        arrivalAtVenue: duplicateFrom.arrivalAtVenue,
        departureFromVenue: duplicateFrom.departureFromVenue,
        arrivalTime: duplicateFrom.arrivalTime,
        transportMethod: duplicateFrom.transportMethod,
        restraintsFitted: duplicateFrom.restraintsFitted,
        childToStaffRatio: duplicateFrom.childToStaffRatio,
        maximumChildren: duplicateFrom.maximumChildren,
        staffAttending: duplicateFrom.staffAttending,
        otherInformation: duplicateFrom.otherInformation,
        itemsToBring: duplicateFrom.itemsToBring,
        medicalAuthorisationText: duplicateFrom.medicalAuthorisationText,
      });
    }
  }, [duplicateFrom]);

  const [riskFile, setRiskFile] = useState<File | null>(null);
  const [emailsRaw, setEmailsRaw] = useState("");
  const [verifiedList, setVerifiedList] = useState<any[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const isPublishedEdit = editData?.status === "sent";

  const handleVerify = () => {
    if (!formData.siteId) {
      toast({ title: "Please select a site first", variant: "destructive" });
      return;
    }
    const emails = emailsRaw
      .split("\n")
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    setIsVerifying(true);
    verifyMut.mutate(
      { data: { siteId: formData.siteId, emails } },
      {
        onSuccess: (data) => setVerifiedList(data),
        onSettled: () => setIsVerifying(false),
      },
    );
  };

  const handleRemoveVerified = (email: string) => {
    setVerifiedList((prev) => prev.filter((v) => v.email !== email));
  };

  const handleSave = async (sendNow: boolean) => {
    if (
      !formData.siteId ||
      !formData.heading ||
      !formData.excursionDate ||
      !formData.venue
    ) {
      toast({
        title: "Missing required fields",
        description: "Site, Heading, Date, and Venue are required.",
        variant: "destructive",
      });
      return;
    }

    // Check if there are any invalid emails remaining in verifiedList
    if (verifiedList.length > 0 && verifiedList.some((v) => !v.valid)) {
      toast({
        title: "Invalid recipients",
        description: "Please remove invalid email addresses before saving.",
        variant: "destructive",
      });
      return;
    }

    const hasExistingRecipients = Boolean(editData?.recipients?.length);
    const hasVerifiedRecipients = verifiedList.some((recipient) => recipient.valid);
    if (sendNow && !hasExistingRecipients && !hasVerifiedRecipients) {
      toast({
        title: "Add a recipient before sending",
        description: "Enter and verify at least one guardian email, then select Save & Send Now again.",
        variant: "destructive",
      });
      return;
    }

    let riskPath = formData.riskAssessmentPath;
    let riskName = formData.riskAssessmentName;

    if (riskFile) {
      if (!formData.siteId) {
        toast({ title: "Site required for upload", variant: "destructive" });
        return;
      }
      setIsUploadingRiskAssessment(true);
      try {
        const uploadRes = await requestUploadMut.mutateAsync({
          data: {
            siteId: formData.siteId,
            name: riskFile.name,
            size: riskFile.size,
            contentType: "application/pdf",
          }
        });
        const putRes = await fetch(uploadRes.uploadURL, {
          method: "PUT",
          body: riskFile,
          headers: { "Content-Type": riskFile.type || "application/pdf" },
        });
        if (!putRes.ok) throw new Error("PUT failed");
        riskPath = uploadRes.objectPath;
        riskName = riskFile.name;
      } catch (err) {
        toast({ title: "Risk assessment upload failed", variant: "destructive" });
        setIsUploadingRiskAssessment(false);
        return;
      }
      setIsUploadingRiskAssessment(false);
    }

    const payload: ExcursionInput = {
      ...(formData as ExcursionInput),
      riskAssessmentPath: riskPath,
      riskAssessmentName: riskName,
      recipientEmails: verifiedList.filter((v) => v.valid).map((v) => v.email),
    };

    const handleSaveSuccess = (targetId: number) => {
      if (sendNow) {
        sendMut.mutate(
          {
            id: targetId,
            data: undefined as any,
          },
          {
            onSuccess: () => {
              toast({ title: "Excursion sent successfully" });
              queryClient.invalidateQueries({ queryKey: getGetExcursionQueryKey(targetId) });
              onSuccess(targetId);
            },
            onError: (error) => {
              toast({
                title: "Excursion saved, but could not be sent",
                description: error.message,
                variant: "destructive",
              });
              queryClient.invalidateQueries({ queryKey: getGetExcursionQueryKey(targetId) });
              onSuccess(targetId);
            },
          },
        );
      } else {
        toast({ title: isPublishedEdit ? "Published excursion updated" : "Excursion draft saved" });
        queryClient.invalidateQueries({ queryKey: getGetExcursionQueryKey(targetId) });
        onSuccess(targetId);
      }
    };

    if (editId) {
      updateMut.mutate(
        { id: editId, data: payload },
        {
          onSuccess: () => handleSaveSuccess(editId),
          onError: (e) =>
            toast({
              title: "Failed to update",
              description: e.message,
              variant: "destructive",
            }),
        }
      );
    } else {
      createMut.mutate(
        { data: payload },
        {
          onSuccess: (created) => handleSaveSuccess(created.id),
          onError: (e) =>
            toast({
              title: "Failed to create",
              description: e.message,
              variant: "destructive",
            }),
        },
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-muted-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">
          {isPublishedEdit ? "Edit Published Excursion" : editId ? "Edit Excursion" : duplicateFrom ? "Duplicate Excursion" : "Plan Excursion"}
        </h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6 text-sm">
          {isPublishedEdit && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">This excursion has already been published.</p>
              <p className="mt-1 text-sm">
                Saved changes appear immediately for guardians. Existing recipients, acknowledgements, and decisions will be preserved.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            <h3 className="font-semibold text-base mb-2">General Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isFullAccess && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>
                    Site <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.siteId?.toString() ?? ""}
                    disabled={isPublishedEdit}
                    onValueChange={(v) => {
                      setFormData({ ...formData, siteId: parseInt(v), riskAssessmentPath: undefined, riskAssessmentName: undefined });
                      setRiskFile(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sites ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5 md:col-span-2">
                <Label>
                  Heading <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.heading}
                  onChange={(e) =>
                    setFormData({ ...formData, heading: e.target.value })
                  }
                  placeholder="e.g. Local Library Storytime"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>
                  Venue <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.venue}
                  onChange={(e) =>
                    setFormData({ ...formData, venue: e.target.value })
                  }
                  placeholder="e.g. City Library"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Description of Activities</Label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="h-20"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="inline-flex w-fit rounded-md border-2 border-red-900 bg-red-900 px-3 py-1.5 text-white">
                  Risk Assessment PDF
                </Label>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    disabled={!formData.siteId}
                    onChange={(e) => setRiskFile(e.target.files?.[0] || null)}
                  />
                  {!formData.siteId && (
                    <p className="text-xs text-muted-foreground">Please select a site first.</p>
                  )}
                  {formData.siteId && formData.riskAssessmentName && !riskFile && (
                    <p className="text-xs text-muted-foreground">Current: {formData.riskAssessmentName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Medical Authorisation Clause</Label>
                <Textarea
                  value={formData.medicalAuthorisationText || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medicalAuthorisationText: e.target.value,
                    })
                  }
                  className="h-20"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col mb-2">
              <h3 className="font-semibold text-base">Permission Form</h3>
              <p className="text-sm text-muted-foreground">Fill in the fields exactly as they will appear on the final permission document.</p>
            </div>

            <Card className="shadow-none rounded-sm border-2 overflow-hidden">
              <div className="bg-[#4a89d6] text-white py-3 px-4">
                <h4 className="text-center text-lg font-bold">{formData.heading || "Excursion Heading"}</h4>
              </div>
              <CardContent className="p-6 grid gap-y-5 [&_input]:text-[#4a89d6] [&_textarea]:text-[#4a89d6]">

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-start">
                  <Label className="font-bold text-sm pt-2 text-foreground">Purpose of Activity:</Label>
                  <Textarea
                    value={formData.purpose || ""}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Date:</Label>
                  <Input
                    type="date"
                    value={formData.excursionDate || ""}
                    onChange={(e) => setFormData({ ...formData, excursionDate: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Cost:</Label>
                  <Input
                    value={formData.cost || ""}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
                  <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                    <Label className="font-bold text-sm text-foreground">Time of Departure from School:</Label>
                    <Input
                      value={formData.departureTime || ""}
                      onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-2 items-center">
                    <Label className="font-bold text-sm text-foreground">Time of arrival at Venue:</Label>
                    <Input
                      value={formData.arrivalAtVenue || ""}
                      onChange={(e) => setFormData({ ...formData, arrivalAtVenue: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
                  <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                    <Label className="font-bold text-sm text-foreground">Time of Departure from Venue:</Label>
                    <Input
                      value={formData.departureFromVenue || ""}
                      onChange={(e) => setFormData({ ...formData, departureFromVenue: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-2 items-center">
                    <Label className="font-bold text-sm text-foreground">Time of arrival at School:</Label>
                    <Input
                      value={formData.arrivalTime || ""}
                      onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center mt-2">
                  <Label className="font-bold text-sm text-foreground">Method of Transport:</Label>
                  <Input
                    value={formData.transportMethod || ""}
                    onChange={(e) => setFormData({ ...formData, transportMethod: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Restraints fitted:</Label>
                  <Input
                    value={formData.restraintsFitted || ""}
                    onChange={(e) => setFormData({ ...formData, restraintsFitted: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Child to staff ratios:</Label>
                  <Input
                    value={formData.childToStaffRatio || ""}
                    onChange={(e) => setFormData({ ...formData, childToStaffRatio: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-center">
                  <Label className="font-bold text-sm text-foreground">Staff in attendance:</Label>
                  <Input
                    value={formData.staffAttending || ""}
                    onChange={(e) => setFormData({ ...formData, staffAttending: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-start mt-2">
                  <Label className="font-bold text-sm pt-2 text-foreground">Other Information:</Label>
                  <Textarea
                    value={formData.otherInformation || ""}
                    onChange={(e) => setFormData({ ...formData, otherInformation: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-2 items-start mt-2">
                  <Label className="font-bold text-sm pt-2 text-foreground">Children will need to bring:</Label>
                  <Textarea
                    value={formData.itemsToBring || ""}
                    onChange={(e) => setFormData({ ...formData, itemsToBring: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>

              </CardContent>
            </Card>
          </div>

          {!isPublishedEdit && (
            <>
              <Separator />
              <h3 className="font-semibold text-base">Recipients (Optional)</h3>

              {verifiedList.length === 0 ? (
            <div className="space-y-3">
              <Label>Paste guardian emails (one per line)</Label>
              <Textarea
                value={emailsRaw}
                onChange={(e) => setEmailsRaw(e.target.value)}
                placeholder="guardian@example.com&#10;another@example.com"
                className="h-32"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleVerify}
                disabled={isVerifying || !emailsRaw.trim()}
              >
                {isVerifying ? "Verifying..." : "Verify Emails"}
              </Button>
            </div>
              ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Verified Recipients</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setVerifiedList([])}
                  className="h-8"
                >
                  Reset List
                </Button>
              </div>
              <div className="space-y-2 border rounded-md p-2 max-h-[300px] overflow-y-auto">
                {verifiedList.map((v, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2 rounded text-sm ${v.valid ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}
                  >
                    <div>
                      <span className="font-medium">{v.email}</span>
                      {v.valid ? (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {v.guardianName} ({v.children.length} children)
                        </div>
                      ) : (
                        <div className="text-xs text-red-600 mt-0.5">
                          No active guardian account or linked active child found
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveVerified(v.email)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
              )}
            </>
          )}

          <div className="flex gap-3 justify-end pt-6">
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
            {isPublishedEdit ? (
              <Button
                type="button"
                onClick={() => handleSave(false)}
                disabled={updateMut.isPending || isUploadingRiskAssessment}
                data-testid="button-save-published-excursion"
              >
                {updateMut.isPending || isUploadingRiskAssessment ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleSave(false)}
                  disabled={createMut.isPending || updateMut.isPending || isUploadingRiskAssessment}
                >
                  Save Draft
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={createMut.isPending || updateMut.isPending || sendMut.isPending || isUploadingRiskAssessment}
                >
                  {sendMut.isPending
                    ? "Sending..."
                    : createMut.isPending || updateMut.isPending || isUploadingRiskAssessment
                      ? "Saving..."
                    : "Save & Send Now"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
