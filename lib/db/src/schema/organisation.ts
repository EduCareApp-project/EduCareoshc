import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const organisationTable = pgTable("organisation", {
  id: serial("id").primaryKey(),
  // Format: 6 digits followed by 1 uppercase letter (e.g. 123456A)
  organisationId: text("organisation_id").unique(),
  name: text("name"),
  childDisplayMode: text("child_display_mode").notNull().default("letter_icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organisation = typeof organisationTable.$inferSelect;
