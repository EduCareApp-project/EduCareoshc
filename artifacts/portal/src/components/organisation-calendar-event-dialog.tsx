import { useEffect, useState } from "react";
import {
  useCreateOrganisationCalendarEvent, useUpdateOrganisationCalendarEvent,
  type OrganisationCalendarEvent, type OrganisationCalendarEventInput,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { errorMessage, isValidYmd } from "./organisation-calendar-utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: OrganisationCalendarEvent | null;
  defaultDate: string;
  onSaved: (event: OrganisationCalendarEvent) => void;
}

export function OrganisationCalendarEventDialog({ open, onOpenChange, event, defaultDate, onSaved }: Props) {
  const create = useCreateOrganisationCalendarEvent();
  const update = useUpdateOrganisationCalendarEvent();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle(event?.title ?? "");
    setStartDate(event?.startDate ?? defaultDate);
    setEndDate(event?.endDate ?? defaultDate);
    setAllDay(event ? !event.startTime : true);
    setStartTime(event?.startTime ?? "09:00");
    setEndTime(event?.endTime ?? "");
    setLocation(event?.location ?? "");
    setDescription(event?.description ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const t = title.trim();
    if (!t) return setError("Enter a title.");
    if (t.length > 200) return setError("Title must be 200 characters or fewer.");
    if (!isValidYmd(startDate) || !isValidYmd(endDate)) return setError("Enter valid start and end dates.");
    if (endDate < startDate) return setError("End date cannot be before the start date.");
    if (!allDay) {
      if (!startTime) return setError("Enter a start time, or mark the event as all day.");
      if (endTime && startDate === endDate && endTime <= startTime) return setError("End time must be after the start time.");
    }
    if (location.length > 300) return setError("Location must be 300 characters or fewer.");
    if (description.length > 5000) return setError("Description must be 5000 characters or fewer.");
    const data: OrganisationCalendarEventInput = {
      title: t, startDate, endDate, location: location.trim(), description: description.trim(),
      startTime: allDay ? null : startTime, endTime: allDay || !endTime ? null : endTime,
    };
    try {
      const saved = event
        ? await update.mutateAsync({ id: event.id, data })
        : await create.mutateAsync({ data });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "The event could not be saved. Please try again."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="dialog-org-event-form">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "Add event"}</DialogTitle>
          <DialogDescription>Visible to all staff across the organisation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert variant="destructive" role="alert" data-testid="text-org-event-error"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-1.5">
            <Label htmlFor="org-ev-title">Title</Label>
            <Input id="org-ev-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} data-testid="input-org-event-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-ev-start">Start date</Label>
              <Input id="org-ev-start" type="date" value={startDate} data-testid="input-org-event-start-date"
                onChange={(e) => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-ev-end">End date</Label>
              <Input id="org-ev-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} data-testid="input-org-event-end-date" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="org-ev-allday" checked={allDay} onCheckedChange={(c) => setAllDay(c === true)} data-testid="checkbox-org-event-all-day" />
            <Label htmlFor="org-ev-allday">All day</Label>
          </div>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="org-ev-st">Start time</Label>
                <Input id="org-ev-st" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-org-event-start-time" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-ev-et">End time (optional)</Label>
                <Input id="org-ev-et" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="input-org-event-end-time" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="org-ev-loc">Location (optional)</Label>
            <Input id="org-ev-loc" value={location} maxLength={300} onChange={(e) => setLocation(e.target.value)} data-testid="input-org-event-location" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-ev-desc">Description (optional)</Label>
            <Textarea id="org-ev-desc" rows={4} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} data-testid="input-org-event-description" />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)} data-testid="button-org-event-cancel">Cancel</Button>
            <Button type="submit" disabled={pending} data-testid="button-org-event-save">
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{event ? "Save changes" : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
