import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  useListOrganisationCalendarEvents, useDeleteOrganisationCalendarEvent,
  getListOrganisationCalendarEventsQueryKey, type OrganisationCalendarEvent,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { fmtMelb } from "@/lib/timezone";
import { OrganisationCalendarEventDialog } from "./organisation-calendar-event-dialog";
import { dateRangeLabel, errorMessage, eventsOnDay, gridDays, parseYmd, timeLabel, toYmd } from "./organisation-calendar-utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function OrganisationCalendar() {
  const today = fmtMelb(new Date(), "yyyy-MM-dd");
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => { const d = parseYmd(today); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrganisationCalendarEvent | null>(null);
  const [deleting, setDeleting] = useState<OrganisationCalendarEvent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const del = useDeleteOrganisationCalendarEvent();

  const days = gridDays(month);
  const range = { from: days[0], to: days[days.length - 1] };
  const { data, isLoading, isError, refetch, isFetching } = useListOrganisationCalendarEvents(range, { query: { refetchInterval: 60000, queryKey: getListOrganisationCalendarEventsQueryKey(range) } });
  const events = data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: [getListOrganisationCalendarEventsQueryKey()[0]] });
  const dayEvents = selected ? eventsOnDay(events, selected) : [];
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  async function confirmDelete() {
    if (!deleting || del.isPending) return;
    try {
      await del.mutateAsync({ id: deleting.id });
      await invalidate();
      setDeleting(null);
    } catch (err) {
      setDeleteError(errorMessage(err, "The event could not be deleted. Please try again."));
    }
  }

  return (
    <Card data-testid="card-org-calendar">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Organisation Calendar</span>
          <Button size="sm" onClick={() => { setSelected(today); setEditing(null); setFormOpen(true); }} data-testid="button-org-calendar-add">
            <Plus className="mr-1 h-4 w-4" /> Add event
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Previous month" data-testid="button-org-calendar-prev"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" aria-live="polite" data-testid="text-org-calendar-month">{format(month, "MMMM yyyy")}</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { const d = parseYmd(today); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} data-testid="button-org-calendar-today">Today</Button>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Next month" data-testid="button-org-calendar-next"><ChevronRight className="h-4 w-4" /></Button>
        </div>

        {isError && (
          <Alert variant="destructive" data-testid="status-org-calendar-error">
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>Events could not be loaded.</span>
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} data-testid="button-org-calendar-retry">Retry</Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <Skeleton className="h-72 w-full" data-testid="skeleton-org-calendar" />
        ) : (
          <div role="grid" aria-label={format(month, "MMMM yyyy")} className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
            {WEEKDAYS.map((w) => (
              <div key={w} className="bg-muted/60 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{w}</div>
            ))}
            {days.map((day) => {
              const list = eventsOnDay(events, day);
              const inMonth = parseYmd(day).getMonth() === month.getMonth();
              const isToday = day === today;
              return (
                <button
                  key={day} type="button" onClick={() => setSelected(day)}
                  aria-label={`${format(parseYmd(day), "EEEE d MMMM yyyy")}${isToday ? ", today" : ""}, ${list.length} event${list.length === 1 ? "" : "s"}`}
                  aria-current={isToday ? "date" : undefined}
                  className={`flex min-h-[3.5rem] flex-col items-stretch gap-0.5 bg-card p-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:min-h-[4.25rem] ${inMonth ? "" : "bg-muted/30 text-muted-foreground"}`}
                  data-testid={`button-org-calendar-day-${day}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isToday ? "bg-primary font-bold text-primary-foreground" : ""}`}>{parseInt(day.slice(8), 10)}</span>
                  {list[0] && <span className="hidden truncate rounded-sm bg-primary/10 px-1 text-[10px] leading-4 text-primary sm:block">{list[0].title}</span>}
                  {list.length > 0 && (
                    <span className="text-[10px] font-medium leading-3 text-primary">
                      <span className="sm:hidden">{list.length} ev.</span>
                      <span className="hidden sm:inline">{list.length > 1 ? `+${list.length - 1} more` : ""}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {!isLoading && !isError && events.length === 0 && (
          <p className="text-center text-xs text-muted-foreground" data-testid="text-org-calendar-empty">No events in this view. Select a day to add one.</p>
        )}
      </CardContent>

      <Dialog open={!!selected && !formOpen && !deleting} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="dialog-org-calendar-day">
          <DialogHeader>
            <DialogTitle>{selected && format(parseYmd(selected), "EEEE d MMMM yyyy")}</DialogTitle>
            <DialogDescription>{dayEvents.length === 0 ? "No events on this day." : `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {dayEvents.map((ev) => (
              <div key={ev.id} className="rounded-md border p-3" data-testid={`card-org-event-${ev.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold">{ev.title}</p>
                  {ev.canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Edit ${ev.title}`} onClick={() => { setEditing(ev); setFormOpen(true); }} data-testid={`button-org-event-edit-${ev.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={`Delete ${ev.title}`} onClick={() => { setDeleteError(null); setDeleting(ev); }} data-testid={`button-org-event-delete-${ev.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
                <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{timeLabel(ev)}{ev.startDate !== ev.endDate && <Badge variant="secondary" className="ml-1 text-[10px]">Multi-day</Badge>}</div>
                  <p>{dateRangeLabel(ev)}</p>
                  {ev.location && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{ev.location}</p>}
                </div>
                {ev.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{ev.description}</p>}
              </div>
            ))}
            <Button className="w-full" onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="button-org-day-add"><Plus className="mr-1 h-4 w-4" /> Add event</Button>
          </div>
        </DialogContent>
      </Dialog>

      <OrganisationCalendarEventDialog
        open={formOpen} onOpenChange={setFormOpen} event={editing}
        defaultDate={selected ?? today} onSaved={(saved) => {
          const day = selected && selected >= saved.startDate && selected <= saved.endDate ? selected : saved.startDate;
          const date = parseYmd(day);
          setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          setSelected(day);
          void invalidate();
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o && !del.isPending) setDeleting(null); }}>
        <AlertDialogContent data-testid="dialog-org-event-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.title}" will be removed for everyone in the organisation. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <Alert variant="destructive" role="alert"><AlertDescription>{deleteError}</AlertDescription></Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending} data-testid="button-org-event-delete-cancel">Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={del.isPending} onClick={confirmDelete} data-testid="button-org-event-delete-confirm">
              {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
