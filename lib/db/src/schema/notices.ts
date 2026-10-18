import { serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { scopedTable as pgTable } from "./scoped-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";
import { organisationTable } from "./organisation";

export const noticesTable = pgTable("notices", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  siteId: integer("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  priority: text("priority").notNull().default("normal"),
  audience: text("audience").notNull().default("leadership"),
  documentPaths: text("notice_document_paths").array(),
  documentNames: text("notice_document_names").array(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNoticeSchema = createInsertSchema(noticesTable).omit({ id: true, createdAt: true, organisationId: true });
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type Notice = typeof noticesTable.$inferSelect;
