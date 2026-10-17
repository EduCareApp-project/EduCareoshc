import { Router, type IRouter, type Request } from "express";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db, calendarEventsTable, type CalendarEvent } from "@workspace/db";
import { organisationContext } from "../middlewares/organisation-context";
import {
  CreateOrganisationCalendarEventBody, UpdateOrganisationCalendarEventBody,
  ListOrganisationCalendarEventsQueryParams,
  z,
} from "@workspace/api-zod";

export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date");

const dateFields = {
  startDate: calendarDate,
  endDate: calendarDate,
  title: z.string().trim().min(1).max(200),
};
function validEventRange(value: {
  startDate: string; endDate: string; startTime?: string | null; endTime?: string | null;
}) {
  return value.endDate >= value.startDate &&
    (!value.endTime || !!value.startTime) &&
    (!value.startTime || !value.endTime || value.endDate > value.startDate || value.endTime > value.startTime);
}
export const calendarCreateInput = CreateOrganisationCalendarEventBody.extend(dateFields).strict()
  .refine(validEventRange, "Event end must follow its start; an end time requires a start time");
export const calendarUpdateInput = UpdateOrganisationCalendarEventBody.extend(dateFields).strict()
  .refine(validEventRange, "Event end must follow its start; an end time requires a start time");
const rangeInput = ListOrganisationCalendarEventsQueryParams.extend({ from: calendarDate, to: calendarDate }).strict()
  .refine((value) => value.to >= value.from, "End date must not precede start date");

const managerRoles = new Set(["director", "admin", "admin_support", "educational_leader"]);
export function canManageCalendarEvent(
  user: { id: number; type: string; role: string }, event: Pick<CalendarEvent, "createdBy">,
) {
  return user.type === "staff" && user.role !== "onboarding" &&
    (managerRoles.has(user.role) || event.createdBy === user.id);
}

const router: IRouter = Router();
router.use((req, res, next) => {
  const user = req.session.user;
  if (!user) { res.status(401).json({ error: "Sign in to access the calendar" }); return; }
  if (user.type !== "staff" || user.role === "onboarding") {
    res.status(403).json({ error: "This calendar is available to educators and leadership only" }); return;
  }
  next();
});

router.use(organisationContext);
function scope(organisationId: number, id?: number) {
  return and(eq(calendarEventsTable.organisationId, organisationId), isNull(calendarEventsTable.siteId),
    id === undefined ? undefined : eq(calendarEventsTable.id, id));
}
function serialise(row: CalendarEvent, req: Request) {
  return { ...row, canEdit: canManageCalendarEvent(req.session.user!, row) };
}
function eventValues(value: z.infer<typeof calendarCreateInput>) {
  return {
    title: value.title, description: value.description ?? "", location: value.location ?? "",
    startDate: value.startDate, endDate: value.endDate,
    startTime: value.startTime ?? null, endTime: value.endTime ?? null,
  };
}
function eventId(raw: unknown) {
  return z.coerce.number().int().positive().safeParse(raw);
}

router.get("/events", async (req, res) => {
  const parsed = rangeInput.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Provide valid from and to dates" }); return; }
  try {
    const organisationId = res.locals.organisationId as number;
    const events = await db.select().from(calendarEventsTable).where(and(
      scope(organisationId), lte(calendarEventsTable.startDate, parsed.data.to),
      gte(calendarEventsTable.endDate, parsed.data.from),
    )).orderBy(asc(calendarEventsTable.startDate), asc(calendarEventsTable.startTime), asc(calendarEventsTable.id));
    res.json(events.map((row) => serialise(row, req)));
  } catch (error) {
    req.log.error({ error }, "Calendar listing failed");
    res.status(500).json({ error: "Unable to load the organisation calendar" });
  }
});

router.post("/events", async (req, res) => {
  const parsed = calendarCreateInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid event" }); return; }
  try {
    const organisationId = res.locals.organisationId as number;
    const [event] = await db.insert(calendarEventsTable).values({
      ...eventValues(parsed.data), organisationId, siteId: null, createdBy: req.session.user!.id,
    }).returning();
    res.status(201).json(serialise(event, req));
  } catch (error) {
    req.log.error({ error }, "Calendar creation failed");
    res.status(500).json({ error: "Unable to save the event" });
  }
});

router.patch("/events/:id", async (req, res) => {
  const id = eventId(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid event id" }); return; }
  const parsed = calendarUpdateInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid event" }); return; }
  try {
    const organisationId = res.locals.organisationId as number;
    const [existing] = await db.select().from(calendarEventsTable).where(scope(organisationId, id.data)).limit(1);
    if (!existing) { res.status(404).json({ error: "Event not found" }); return; }
    if (!canManageCalendarEvent(req.session.user!, existing)) {
      res.status(403).json({ error: "Only the event creator or organisation leadership can edit this event" }); return;
    }
    const owner = managerRoles.has(req.session.user!.role) ? undefined : eq(calendarEventsTable.createdBy, req.session.user!.id);
    const [event] = await db.update(calendarEventsTable).set(eventValues(parsed.data))
      .where(and(scope(organisationId, id.data), owner)).returning();
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    res.json(serialise(event, req));
  } catch (error) {
    req.log.error({ error }, "Calendar update failed");
    res.status(500).json({ error: "Unable to update the event" });
  }
});

router.delete("/events/:id", async (req, res) => {
  const id = eventId(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid event id" }); return; }
  try {
    const organisationId = res.locals.organisationId as number;
    const [existing] = await db.select().from(calendarEventsTable).where(scope(organisationId, id.data)).limit(1);
    if (!existing) { res.status(404).json({ error: "Event not found" }); return; }
    if (!canManageCalendarEvent(req.session.user!, existing)) {
      res.status(403).json({ error: "Only the event creator or organisation leadership can delete this event" }); return;
    }
    const owner = managerRoles.has(req.session.user!.role) ? undefined : eq(calendarEventsTable.createdBy, req.session.user!.id);
    const [deleted] = await db.delete(calendarEventsTable).where(and(scope(organisationId, id.data), owner)).returning({ id: calendarEventsTable.id });
    if (!deleted) { res.status(404).json({ error: "Event not found" }); return; }
    res.status(204).end();
  } catch (error) {
    req.log.error({ error }, "Calendar deletion failed");
    res.status(500).json({ error: "Unable to delete the event" });
  }
});

export default router;
