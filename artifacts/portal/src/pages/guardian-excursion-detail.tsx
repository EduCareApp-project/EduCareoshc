import { useEffect, useRef, useState } from "react";
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
  const viewedSubmittedRef = useRef(false);

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
    if (excursion && !excursion.guardianViewedAt && !viewedSubmittedRef.current) {
      viewedSubmittedRef.current = true;
      markViewed.mutate(
        { id: excursionId, recipientId },
        {
          onSuccess: (updatedExcursion) => {
            queryClient.setQueryData(
              getGetGuardianExcursionQueryKey(excursionId, recipientId),
              updatedExcursion,
            );
          },
          onError: () => {
            viewedSubmittedRef.current = false;
          },
        },
      );
    }
  }, [excursion, excursionId, recipientId, markViewed, queryClient]);

  const handleAcknowledge = () => {
    acknowledge.mutate(
      { id: excursionId, recipientId },
      {
        onSuccess: (updatedExcursion) => {
          queryClient.setQueryData(
            getGetGuardianExcursionQueryKey(excursionId, recipientId),
            updatedExcursion,
          );
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
        onSuccess: (updatedExcursion) => {
          toast({ title: "Excursion form submitted successfully" });
          queryClient.setQueryData(
            getGetGuardianExcursionQueryKey(excursionId, recipientId),
            updatedExcursion,
          );
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

      <Card className="shadow-none rounded-sm border-2 overflow-hidden" data-testid="guardian-saved-permission-form">
        <div className="bg-[#4a89d6] text-white py-3 px-4">
          <h2 className="text-center text-lg font-bold">{excursion.heading}</h2>
        </div>
        <CardContent className="p-6 text-sm text-foreground grid gap-y-5">
          {excursion.riskAssessmentName && (
            <div className="flex flex-col gap-3 rounded-md border-2 border-emerald-700 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div>
                  <div className="font-bold text-emerald-800">Risk Assessment PDF</div>
                  <div className="mt-0.5 text-sm text-emerald-950">
                    {excursion.riskAssessmentName}
                  </div>
                </div>
              </div>
              <Button className="bg-emerald-700 text-white hover:bg-emerald-800" asChild>
                <a
                  href={`/api/excursions/${excursion.id}/risk-assessment`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Risk Assessment PDF
                </a>
              </Button>
            </div>
          )}

          {[
            ["Purpose of Activity:", excursion.purpose],
            ["Date:", new Date(excursion.excursionDate).toLocaleDateString("en-AU")],
            ["Cost:", excursion.cost],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
              <div className="font-bold">{label}</div>
              <div className="whitespace-pre-wrap text-[#4a89d6]">{value}</div>
            </div>
          ))}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 mt-1">
            <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
              <div className="font-bold">Time of Departure from School:</div>
              <div className="text-[#4a89d6]">{excursion.departureTime}</div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-1">
              <div className="font-bold">Time of arrival at Venue:</div>
              <div className="text-[#4a89d6]">{excursion.arrivalAtVenue}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
            <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
              <div className="font-bold">Time of Departure from Venue:</div>
              <div className="text-[#4a89d6]">{excursion.departureFromVenue}</div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-x-4 gap-y-1">
              <div className="font-bold">Time of arrival at School:</div>
              <div className="text-[#4a89d6]">{excursion.arrivalTime}</div>
            </div>
          </div>

          {[
            ["Method of Transport:", excursion.transportMethod],
            ["Restraints fitted:", excursion.restraintsFitted],
            ["Child to staff ratios:", excursion.childToStaffRatio],
            ["Staff in attendance:", excursion.staffAttending],
            ["Other Information:", excursion.otherInformation],
            ["Children will need to bring:", excursion.itemsToBring],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-x-4 gap-y-1">
              <div className="font-bold">{label}</div>
              <div className="whitespace-pre-wrap text-[#4a89d6]">{value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-primary/5 pb-4 border-b">
          <CardTitle className="text-lg">Declaration and Permission</CardTitle>
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
