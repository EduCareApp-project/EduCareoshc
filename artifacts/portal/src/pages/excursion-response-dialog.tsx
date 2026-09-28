import type { ExcursionResponseLog } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  childName: string;
  guardianEmail: string;
  decision: "granted" | "declined";
  response?: ExcursionResponseLog;
};

export default function ExcursionResponseDialog({ childName, guardianEmail, decision, response }: Props) {
  const metadata = response?.metadata;
  const text = (key: string) => {
    const value = metadata?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const signature = text("signatureDataUrl");
  const safeSignature = signature && /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(signature)
    ? signature
    : null;
  const signedAt = text("signedAt") ?? response?.createdAt;
  const signedDate = signedAt && !Number.isNaN(new Date(signedAt).getTime())
    ? new Date(signedAt).toLocaleString("en-AU")
    : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">View response</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permission response for {childName}</DialogTitle>
          <DialogDescription>Submitted by {guardianEmail}. This record is read-only.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <div className="rounded-md border bg-muted/40 p-3">
            <span className="font-medium">Attendance decision: </span>
            {decision === "granted" ? "Permission granted" : "Permission declined"}
          </div>
          {response?.metadata ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  ["Full name", text("guardianName")],
                  ["Relationship to child", text("relationship")],
                  ["Home phone", text("homePhone")],
                  ["Work phone", text("workPhone")],
                  ["Mobile phone", text("mobilePhone")],
                ] as const).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-muted-foreground text-xs">{label}</p>
                    <p className="font-medium break-words">{value ?? "Not provided"}</p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-1">
                <p className="font-medium">Medical declaration</p>
                <p>{metadata?.medicalAcknowledgement === true ? "Acknowledged" : "Not recorded"}</p>
              </div>
              <div className="border-t pt-4 space-y-2">
                <p className="font-medium">Signature</p>
                {safeSignature ? (
                  <div className="rounded-md border bg-white p-3">
                    <img src={safeSignature} alt={`Signature of ${text("typedSignatureName") ?? "guardian"}`} className="max-h-32 max-w-full mx-auto" />
                  </div>
                ) : <p className="text-muted-foreground">Drawn signature not available.</p>}
                <p>Signed by: {text("typedSignatureName") ?? "Not recorded"}</p>
                <p>Signed at: {signedDate ?? "Not recorded"}</p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              The submitted form details are not available for this response.
              {signedDate ? ` Response recorded ${signedDate}.` : ""}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}