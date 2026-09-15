import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetGuardianExcursion,
  useMarkGuardianExcursionViewed,
  useAcknowledgeGuardianExcursion,
  useSubmitGuardianExcursionDecision,
  getGetGuardianExcursionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  MapPin,
  Clock,
  Info,
  Bus,
  ShieldAlert,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/ui/signature-pad";

export default function GuardianExcursionDetail() {
  const { id, recipientId: rid } = useParams();
  const excursionId = Number(id);
  const recipientId = Number(rid);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: excursion, isLoading } = useGetGuardianExcursion(excursionId, recipientId);
  const markViewed = useMarkGuardianExcursionViewed();
  const acknowledge = useAcknowledgeGuardianExcursion();
  const submitDecision = useSubmitGuardianExcursionDecision();

  const [decision, setDecision] = useState<"granted" | "declined" | null>(null);
  const [typedGuardianName, setTypedGuardianName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [homePhone, setHomePhone] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [medicalAcknowledgement, setMedicalAcknowledgement] = useState(false);
  const [typedSignatureName, setTypedSignatureName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");

  // Mark viewed on load
  useEffect(() => {
    if (excursion && !excursion.guardianViewedAt) {
      markViewed.mutate({ id: excursionId, recipientId });
    }
  }, [excursion, excursionId, recipientId, markViewed]);

  const handleAcknowledge = () => {
    acknowledge.mutate(
      { id: excursionId, recipientId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetGuardianExcursionQueryKey(excursionId, recipientId),
          });
        },
      },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) {
      toast({
        title: "Please select attendance decision",
        variant: "destructive",
      });
      return;
    }
    if (!medicalAcknowledgement) {
      toast({
        title: "Please acknowledge the medical declaration",
        variant: "destructive",
      });
      return;
    }
    if (!signatureDataUrl) {
      toast({ title: "Please sign the form", variant: "destructive" });
      return;
    }

    submitDecision.mutate(
      {
        id: excursionId,
        recipientId,
        data: {
          decision,
          typedGuardianName,
          relationship,
          homePhone,
          workPhone,
          mobilePhone,
          medicalAcknowledgement,
          typedSignatureName,
          signatureDataUrl,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Excursion form submitted successfully" });
          queryClient.invalidateQueries({
            queryKey: getGetGuardianExcursionQueryKey(excursionId, recipientId),
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/guardian/excursions"],
          }); // to update list
        },
        onError: (err) => {
          toast({
            title: "Submission failed",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in max-w-3xl mx-auto">
        <Skeleton className="h-10 w-32" />
        <Card>
          <CardContent className="h-64 pt-6">
            <Skeleton className="h-full w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!excursion) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">Excursion not found</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  const isCompleted = !!excursion.decision;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-3 text-muted-foreground hover:text-foreground"
      >
        <Link href="/">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Home
        </Link>
      </Button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          {isCompleted ? (
            excursion.decision === "granted" ? (
              <Badge className="bg-emerald-500 hover:bg-emerald-600 mb-2">
                Permission Granted
              </Badge>
            ) : (
              <Badge variant="destructive" className="mb-2">
                Permission Declined
              </Badge>
            )
          ) : (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-800 border-amber-200 mb-2"
            >
              Action Required
            </Badge>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {excursion.heading}
          </h1>
          <p className="text-muted-foreground mt-2">{excursion.venue}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-lg">Excursion Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Date
              </span>
              <p className="font-medium text-foreground">
                {new Date(excursion.excursionDate).toLocaleDateString("en-AU", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> Location
              </span>
              <p className="font-medium text-foreground">{excursion.venue}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Departure Time
              </span>
              <p className="font-medium text-foreground">
                {excursion.departureTime}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Return Time
              </span>
              <p className="font-medium text-foreground">
                {excursion.arrivalTime}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Info className="h-4 w-4" /> Cost
              </span>
              <p className="font-medium text-foreground">{excursion.cost}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Bus className="h-4 w-4" /> Transport
              </span>
              <p className="font-medium text-foreground">
                {excursion.transportMethod}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> Restraints
              </span>
              <p className="font-medium text-foreground">
                {excursion.restraintsFitted}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Info className="h-4 w-4" /> Ratio
              </span>
              <p className="font-medium text-foreground">
                {excursion.childToStaffRatio}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-1 text-foreground">
                Reason for Excursion
              </h4>
              <p className="text-sm text-muted-foreground">
                {excursion.purpose}
              </p>
            </div>

            {excursion.description && (
              <div>
                <h4 className="font-semibold text-sm mb-1 text-foreground">
                  Description of Activities
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {excursion.description}
                </p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-sm mb-1 text-foreground">
                Items to Bring
              </h4>
              <p className="text-sm text-muted-foreground">
                {excursion.itemsToBring}
              </p>
            </div>

            {excursion.riskAssessmentName && (
              <div className="pt-2">
                <a
                  href={`/api/excursions/${excursion.id}/risk-assessment`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  View Risk Assessment
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-primary/5 pb-4 border-b">
          <CardTitle className="text-lg">Permission Form</CardTitle>
          <CardDescription>
            Please complete the details below to authorize this excursion.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Child Info */}
            <div className="space-y-3">
              <Label>Child attending</Label>
              <div className="p-3 bg-muted rounded-md font-medium flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {excursion.childName.charAt(0)}
                </div>
                {excursion.childName}
              </div>
            </div>

            {/* Guardian Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="typedGuardianName">Full Name</Label>
                <Input
                  id="typedGuardianName"
                  value={
                    isCompleted
                      ? (excursion.signedMetadata?.guardianName ?? "")
                      : typedGuardianName
                  }
                  onChange={(e) => setTypedGuardianName(e.target.value)}
                  disabled={isCompleted}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship to child</Label>
                <Input
                  id="relationship"
                  value={
                    isCompleted
                      ? (excursion.signedMetadata?.relationship ?? "")
                      : relationship
                  }
                  onChange={(e) => setRelationship(e.target.value)}
                  disabled={isCompleted}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homePhone">Home Phone (Optional)</Label>
                <Input
                  id="homePhone"
                  value={
                    isCompleted
                      ? (excursion.signedMetadata?.homePhone ?? "")
                      : homePhone
                  }
                  onChange={(e) => setHomePhone(e.target.value)}
                  disabled={isCompleted}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workPhone">Work Phone (Optional)</Label>
                <Input
                  id="workPhone"
                  value={
                    isCompleted
                      ? (excursion.signedMetadata?.workPhone ?? "")
                      : workPhone
                  }
                  onChange={(e) => setWorkPhone(e.target.value)}
                  disabled={isCompleted}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mobilePhone">Mobile Phone</Label>
                <Input
                  id="mobilePhone"
                  value={
                    isCompleted
                      ? (excursion.signedMetadata?.mobilePhone ?? "")
                      : mobilePhone
                  }
                  onChange={(e) => setMobilePhone(e.target.value)}
                  disabled={isCompleted}
                />
              </div>
            </div>

            <Separator />

            {/* Medical Declaration */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Medical Declaration</h3>
              <div className="p-4 bg-muted/50 rounded-lg text-sm leading-relaxed border">
                {excursion.medicalAuthorisationText ||
                  "In the event of an emergency, illness, or accident concerning my child, and if the nominated contact people cannot be reached, I authorise the educator/person in charge to consent to my child receiving medical, dental, or surgical treatment as deemed necessary by a medical practitioner or hospital."}
              </div>

              <div className="flex items-start space-x-3 mt-4">
                <Checkbox
                  id="medicalAck"
                  data-testid="checkbox-medical-ack"
                  checked={isCompleted ? true : medicalAcknowledgement}
                  onCheckedChange={(c) => {
                    setMedicalAcknowledgement(c === true);
                    if (c === true && !excursion.guardianAcknowledgedAt) {
                      handleAcknowledge();
                    }
                  }}
                  disabled={isCompleted}
                  className="mt-1"
                />
                <Label
                  htmlFor="medicalAck"
                  className="text-sm font-normal leading-relaxed cursor-pointer"
                >
                  I acknowledge the medical declaration and authorise medical
                  treatment if required.
                </Label>
              </div>
            </div>

            <Separator />

            {/* Decision */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Attendance Decision</h3>
              <RadioGroup
                value={isCompleted ? excursion.decision : decision!}
                onValueChange={(v: "granted" | "declined") => setDecision(v)}
                disabled={isCompleted}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem
                    value="granted"
                    id="granted"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="granted"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-500" />I
                    grant permission
                  </Label>
                </div>
                <div>
                  <RadioGroupItem
                    value="declined"
                    id="declined"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="declined"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-destructive [&:has([data-state=checked])]:border-destructive cursor-pointer"
                  >
                    <XCircle className="mb-2 h-6 w-6 text-destructive" />I
                    decline permission
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Signature */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base">Signature</h3>

              {isCompleted ? (
                <div className="space-y-4">
                  <div className="border rounded-md p-4 bg-white flex justify-center h-40">
                    {excursion.signedMetadata?.signatureDataUrl && (
                      <img
                        src={excursion.signedMetadata.signatureDataUrl}
                        alt="Signature"
                        className="max-h-full"
                      />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex justify-between">
                    <span>
                      Signed by: {excursion.signedMetadata?.typedSignatureName ?? ""}
                    </span>
                    <span>
                      Date:{" "}
                      {excursion.signedAt
                        ? new Date(excursion.signedAt).toLocaleString()
                        : ""}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="typedSignatureName">
                      Type your name to sign
                    </Label>
                    <Input
                      id="typedSignatureName"
                      value={typedSignatureName}
                      onChange={(e) => setTypedSignatureName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Draw your signature</Label>
                    <SignaturePad onSign={setSignatureDataUrl} />
                  </div>
                </div>
              )}
            </div>

            {!isCompleted && (
              <div className="pt-4">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto"
                  data-testid="button-submit-excursion"
                  disabled={submitDecision.isPending}
                >
                  {submitDecision.isPending ? "Submitting..." : "Submit Form"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
