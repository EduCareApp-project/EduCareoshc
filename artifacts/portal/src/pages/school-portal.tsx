import { useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/contexts/auth";
import { 
  useGetSchoolPortal, 
  useGetSchoolStaff,
  useCreateVitalRecord, 
  useDeleteVitalRecord,
  useCreateVecraVisit,
  useDeleteVecraVisit
} from "@/hooks/use-schools";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { 
  Building2, Users, FileText, ClipboardCheck, ArrowLeft, 
  Plus, Trash2, CalendarIcon, FileClock,
  MapPin, Clock, Paperclip, ChevronDown, BookOpen, TrendingUp, Mail, Phone, User, GraduationCap
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ServiceDocumentationPanel } from "@/components/service-documentation-panel";
import QipPublic from "@/pages/qip-public";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

function formatExpiryDate(value: string): { label: string; expired: boolean } | null {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return {
    label: format(date, "MMM d, yyyy"),
    expired: date < new Date(),
  };
}

const vitalRecordSchema = z.object({
  recordType: z.string().min(1, "Record type is required"),
  recordName: z.string().min(1, "Record name is required"),
  provider: z.string().optional(),
  referenceNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

const vecraVisitSchema = z.object({
  visitDate: z.string().min(1, "Visit date is required"),
  visitorName: z.string().min(1, "Visitor name is required"),
  visitorOrganisation: z.string().optional(),
  findings: z.string().optional(),
  actions: z.string().optional(),
  followUpDate: z.string().optional(),
});

function profileImageUrl(path: string) {
  return `/api/storage/objects/${path.replace(/^\/objects\//, "")}`;
}

function SchoolStaffProfileView({
  siteId,
  staffId,
  onBack,
}: {
  siteId: number;
  staffId: number;
  onBack: () => void;
}) {
  const { data, isLoading, isError } = useGetSchoolStaff(siteId, staffId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Service Staff
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Unable to load this staff profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { staff: member, qualifications } = data;
  const roleLabel = member.role.replace(/_/g, " ");

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Service Staff
      </Button>

      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="shrink-0">
              {member.profilePicturePath ? (
                <img
                  src={profileImageUrl(member.profilePicturePath)}
                  alt={`${member.firstName} ${member.lastName}`}
                  className="h-28 w-28 rounded-2xl border-2 border-border object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    (event.currentTarget.nextElementSibling as HTMLElement | null)?.style.removeProperty("display");
                  }}
                />
              ) : null}
              <div
                className={`flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-border bg-primary/10 text-primary/60 ${member.profilePicturePath ? "hidden" : ""}`}
              >
                <User className="h-12 w-12" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight">
                  {member.firstName} {member.lastName}
                </h2>
                <Badge variant="secondary" className="capitalize">{roleLabel}</Badge>
              </div>

              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <a href={`mailto:${member.email}`} className="flex min-w-0 items-center gap-2 text-primary hover:underline">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </a>
                {member.phone ? (
                  <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Phone className="h-4 w-4 shrink-0" />
                    {member.phone}
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    Phone not provided
                  </div>
                )}
              </div>

              <div className="mt-6 border-t pt-5">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bio</h3>
                {member.bio ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{member.bio}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No bio provided.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Qualifications</CardTitle>
              <CardDescription>All qualifications recorded for this staff member.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {qualifications.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              No qualifications recorded.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {qualifications.map((qualification) => {
                const expiry = qualification.expiryDate ? formatExpiryDate(String(qualification.expiryDate)) : null;
                return (
                  <div key={qualification.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{qualification.name}</p>
                      {qualification.referenceNumber && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reference: <span className="font-mono">{qualification.referenceNumber}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={qualification.status === "current" ? "default" : "secondary"} className="capitalize">
                        {qualification.status.replace(/_/g, " ")}
                      </Badge>
                      {expiry && (
                        <span className={expiry.expired ? "font-medium text-destructive" : "text-muted-foreground"}>
                          Expires {expiry.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SchoolPortal() {
  const { user } = useAuth();
  const params = useParams();
  const siteId = user?.type === "school" ? user.siteId : Number(params.siteId);
  const { toast } = useToast();

  const { data, isLoading } = useGetSchoolPortal(siteId);

  const [vitalOpen, setVitalOpen] = useState(false);
  const [serviceDocsOpen, setServiceDocsOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [vecraOpen, setVecraOpen] = useState(false);
  const [vitalFile, setVitalFile] = useState<File | null>(null);
  const [vitalUploadError, setVitalUploadError] = useState<string | null>(null);
  const vitalFileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile: uploadVitalFile, isUploading: isUploadingVitalFile } = useUpload({
    onError: (error) => {
      setVitalUploadError(error.message);
      toast({
        title: "Document upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createVital = useCreateVitalRecord(siteId!);
  const deleteVital = useDeleteVitalRecord(siteId!);
  const createVecra = useCreateVecraVisit(siteId!);
  const deleteVecra = useDeleteVecraVisit(siteId!);

  const vitalForm = useForm<z.infer<typeof vitalRecordSchema>>({
    resolver: zodResolver(vitalRecordSchema),
    defaultValues: {
      recordType: "",
      recordName: "",
      provider: "",
      referenceNumber: "",
      expiryDate: "",
      notes: "",
    }
  });

  const vecraForm = useForm<z.infer<typeof vecraVisitSchema>>({
    resolver: zodResolver(vecraVisitSchema),
    defaultValues: {
      visitDate: "",
      visitorName: "",
      visitorOrganisation: "",
      findings: "",
      actions: "",
      followUpDate: "",
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data?.site) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto opacity-20 mb-4" />
        <p>School portal not found.</p>
        {user?.type === "staff" && (
          <Link href="/schools" className="mt-4 inline-block text-primary hover:underline">
            Return to Schools
          </Link>
        )}
      </div>
    );
  }

  const { site, staff, vitalRecords, vecraVisits } = data;
  const isStaff = user?.type === "staff";

  const resetVitalForm = () => {
    vitalForm.reset();
    setVitalFile(null);
    setVitalUploadError(null);
    if (vitalFileInputRef.current) vitalFileInputRef.current.value = "";
  };

  const onVitalSubmit = async (values: z.infer<typeof vitalRecordSchema>) => {
    if (!vitalFile) {
      toast({ title: "Supporting document required", description: "Upload the document for this vital record before saving.", variant: "destructive" });
      return;
    }
    setVitalUploadError(null);
    try {
      const upload = await uploadVitalFile(vitalFile);
      if (!upload) return;
      await createVital.mutateAsync({
        ...values,
        documentPath: upload.objectPath,
        documentName: vitalFile.name,
      });
      toast({ title: "Vital record added successfully" });
      setVitalOpen(false);
      resetVitalForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast({ title: "Failed to add record", description: message, variant: "destructive" });
    }
  };

  const onVecraSubmit = (values: z.infer<typeof vecraVisitSchema>) => {
    createVecra.mutate(values, {
      onSuccess: () => {
        toast({ title: "VECRA visit added successfully" });
        setVecraOpen(false);
        vecraForm.reset();
      },
      onError: (err: any) => {
        toast({ title: "Failed to add visit", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {isStaff && (
        <Button variant="ghost" size="sm" asChild className="mb-[-1rem] -ml-2 text-muted-foreground hover:text-foreground">
          <Link href="/schools">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Schools
          </Link>
        </Button>
      )}

      {/* Header Profile */}
      <div className="bg-card border rounded-xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
        <div className="h-20 w-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
          <Building2 className="h-10 w-10" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{site.name}</h1>
            <Badge variant={site.status === "active" ? "default" : "secondary"}>
              {site.status}
            </Badge>
            {site.isDoscel && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                DOSCEL
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 opacity-70" />
              {site.address}
            </div>
            {site.grouping && (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 opacity-70" />
                {site.grouping}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 opacity-70" />
              Since {format(new Date(site.createdAt), "MMM yyyy")}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="vital" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
          <TabsTrigger 
            value="vital" 
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12"
          >
            <FileClock className="w-4 h-4 mr-2" />
            Vital Records
          </TabsTrigger>
          <TabsTrigger 
            value="vecra"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12"
          >
            <ClipboardCheck className="w-4 h-4 mr-2" />
            VECRA Visits
          </TabsTrigger>
          <TabsTrigger 
            value="staff"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12"
          >
            <Users className="w-4 h-4 mr-2" />
            Service Staff
          </TabsTrigger>
          <TabsTrigger 
            value="reports"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12"
          >
            <FileText className="w-4 h-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger
            value="qip"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            QIP
          </TabsTrigger>
        </TabsList>

        <div className="pt-6">
          {/* Vital Records Tab */}
          <TabsContent value="vital" className="mt-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">Vital Records</h3>
                <p className="text-sm text-muted-foreground">Important licenses, certificates, and compliance records.</p>
              </div>
              {isStaff && <Dialog open={vitalOpen} onOpenChange={(open) => {
                setVitalOpen(open);
                if (!open) resetVitalForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Add Record
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Vital Record</DialogTitle>
                    <DialogDescription>
                      Enter details of the compliance or certification record.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...vitalForm}>
                    <form onSubmit={vitalForm.handleSubmit(onVitalSubmit)} className="space-y-4">
                      <FormField
                        control={vitalForm.control}
                        name="recordType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Record Type</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. License, Accreditation" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vitalForm.control}
                        name="recordName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Record Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Service Approval" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={vitalForm.control}
                          name="provider"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Provider (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. ACECQA" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vitalForm.control}
                          name="referenceNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reference # (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={vitalForm.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date (Optional)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vitalForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Additional information..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="vital-supporting-document">Supporting Document</Label>
                        <Input
                          id="vital-supporting-document"
                          ref={vitalFileInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                           onChange={(event) => {
                             setVitalFile(event.target.files?.[0] ?? null);
                             setVitalUploadError(null);
                           }}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Upload the certificate, licence, or other document for this record.
                        </p>
                        {vitalFile && (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Paperclip className="h-3.5 w-3.5" />
                            {vitalFile.name}
                          </p>
                        )}
                         {vitalUploadError && (
                           <p className="text-xs text-destructive">{vitalUploadError}</p>
                         )}
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={createVital.isPending || isUploadingVitalFile}>
                          {isUploadingVitalFile ? "Uploading..." : createVital.isPending ? "Saving..." : "Save Record"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>}
            </div>

            {vitalRecords.length === 0 ? (
              <Card className="border-dashed shadow-none bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileClock className="w-12 h-12 opacity-20 mb-4" />
                  <p>No vital records found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vitalRecords.map((record) => (
                  <Card key={record.id} className="relative group">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">{record.recordType}</p>
                          <CardTitle className="text-base line-clamp-2">{record.recordName}</CardTitle>
                        </div>
                        {isStaff && <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive shrink-0"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this record?")) {
                              deleteVital.mutate(record.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>}
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2 pb-4">
                      {record.provider && (
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Provider</span>
                          <span className="font-medium text-right">{record.provider}</span>
                        </div>
                      )}
                      {record.referenceNumber && (
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Ref #</span>
                          <span className="font-mono text-xs mt-0.5">{record.referenceNumber}</span>
                        </div>
                      )}
                      {record.expiryDate && (() => {
                        const expiry = formatExpiryDate(record.expiryDate);
                        return expiry ? (
                          <div className="flex justify-between pt-1">
                            <span className="text-muted-foreground">Expires</span>
                            <span className={`font-medium ${expiry.expired ? "text-destructive" : ""}`}>
                              {expiry.label}
                            </span>
                          </div>
                        ) : null;
                      })()}
                      {record.notes && (
                        <div className="pt-2 text-muted-foreground text-xs bg-muted/50 p-2 rounded mt-2">
                          {record.notes}
                        </div>
                      )}
                      {record.documentPath && (
                        <a
                          href={`/api/schools/${site.id}/vital-records/${record.id}/document`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 pt-2 text-xs font-medium text-primary hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {record.documentName ?? "View supporting document"}
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Collapsible
              open={serviceDocsOpen}
              onOpenChange={setServiceDocsOpen}
              className="mt-8"
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex h-auto w-full items-center justify-between rounded-none bg-emerald-600 px-5 py-4 text-left text-white hover:bg-emerald-700 hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-white" />
                      <span>
                        <span className="block font-semibold">Service Documentation</span>
                        <span className="block text-xs font-normal text-white">
                          Published documents available for this site, as shown to parents
                        </span>
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-white transition-transform ${serviceDocsOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="border-t bg-muted/10 p-5">
                    <ServiceDocumentationPanel siteId={site.id} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </TabsContent>

          {/* Public QIP Tab */}
          <TabsContent value="qip" className="mt-0">
            <QipPublic siteId={site.id} embedded />
          </TabsContent>

          {/* VECRA Visits Tab */}
          <TabsContent value="vecra" className="mt-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">VECRA Visits</h3>
                <p className="text-sm text-muted-foreground">Victorian Early Childhood Regulatory Authority visit logs.</p>
              </div>
              {isStaff && <Dialog open={vecraOpen} onOpenChange={setVecraOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Log Visit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log VECRA Visit</DialogTitle>
                    <DialogDescription>
                      Record details of a regulatory authority visit.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...vecraForm}>
                    <form onSubmit={vecraForm.handleSubmit(onVecraSubmit)} className="space-y-4">
                      <FormField
                        control={vecraForm.control}
                        name="visitDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Visit Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={vecraForm.control}
                          name="visitorName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Visitor Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Jane Doe" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vecraForm.control}
                          name="visitorOrganisation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Organisation (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. DET" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={vecraForm.control}
                        name="findings"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Findings (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Summary of findings..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vecraForm.control}
                        name="actions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Required Actions (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Actions to be taken..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vecraForm.control}
                        name="followUpDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Follow-up Date (Optional)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={createVecra.isPending}>
                          {createVecra.isPending ? "Saving..." : "Save Visit"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>}
            </div>

            {vecraVisits.length === 0 ? (
              <Card className="border-dashed shadow-none bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardCheck className="w-12 h-12 opacity-20 mb-4" />
                  <p>No visits recorded yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {vecraVisits.map((visit) => (
                  <Card key={visit.id} className="relative group">
                    <CardHeader className="pb-2 flex flex-row items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 flex items-center justify-center">
                          <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Visit on {format(new Date(visit.visitDate), "MMMM d, yyyy")}
                          </CardTitle>
                          <CardDescription>
                            By {visit.visitorName} {visit.visitorOrganisation ? `(${visit.visitorOrganisation})` : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this visit record?")) {
                            deleteVecra.mutate(visit.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        {visit.findings && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Findings</span>
                            <p className="text-sm bg-muted/30 p-3 rounded-md">{visit.findings}</p>
                          </div>
                        )}
                        {visit.actions && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Required Actions</span>
                            <p className="text-sm bg-muted/30 p-3 rounded-md">{visit.actions}</p>
                          </div>
                        )}
                      </div>
                      {visit.followUpDate && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 font-medium bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-md w-fit">
                          <Clock className="h-4 w-4" />
                          Follow-up required by {format(new Date(visit.followUpDate), "MMM d, yyyy")}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff" className="mt-0">
            {selectedStaffId ? (
              <SchoolStaffProfileView
                siteId={site.id}
                staffId={selectedStaffId}
                onBack={() => setSelectedStaffId(null)}
              />
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold">Service Staff</h3>
                  <p className="text-sm text-muted-foreground">Educators and staff members assigned or associated with this site.</p>
                </div>

                {staff.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      No staff members found for this site.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {staff.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className="text-left"
                        onClick={() => setSelectedStaffId(member.id)}
                        aria-label={`Open profile for ${member.firstName} ${member.lastName}`}
                      >
                        <Card className="h-full transition-colors hover:border-primary hover:bg-muted/30">
                          <CardContent className="flex h-full items-start gap-4 p-5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                              {member.firstName[0]}{member.lastName[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold">{member.firstName} {member.lastName}</p>
                              <p className="mt-1 text-xs capitalize text-primary">{member.role.replace(/_/g, " ")}</p>
                              {member.qualifications && (
                                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{member.qualifications}</p>
                              )}
                              {member.associatedSites && member.associatedSites.length > 0 && (
                                <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
                                  <Building2 className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="line-clamp-2">{member.associatedSites.map((associatedSite) => associatedSite.name).join(", ")}</span>
                                </p>
                              )}
                              <p className="mt-4 text-xs font-medium text-primary">View profile</p>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Reports Placeholder */}
          <TabsContent value="reports" className="mt-0">
             <Card className="border-dashed shadow-none bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
                  <FileText className="w-16 h-16 opacity-20 mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">School Reports</h3>
                  <p className="max-w-sm">
                    Detailed reporting and analytics for this school are coming later. Check back soon for updates.
                  </p>
                </CardContent>
              </Card>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}
