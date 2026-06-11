import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";

export type SiteQuickRef = {
  address?: string;
  securityCodes?: string;
  programType?: string;
  hours?: {
    bsc?: { open?: string; close?: string };
    asc?: { open?: string; close?: string };
    vac?: { open?: string; close?: string };
  };
};

export type SiteSection = {
  id: string;
  title: string;
  content: string;
};

export type SiteContact = {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export const siteInstructionsTable = pgTable("site_instructions", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().unique().references(() => sitesTable.id, { onDelete: "cascade" }),
  quickRef: jsonb("quick_ref").$type<SiteQuickRef>().notNull().default({}),
  sections: jsonb("sections").$type<SiteSection[]>().notNull().default([]),
  contacts: jsonb("contacts").$type<SiteContact[]>().notNull().default([]),
  photos: text("photos").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  updatedById: integer("updated_by_id").references(() => staffTable.id, { onDelete: "set null" }),
});

export type SiteInstructions = typeof siteInstructionsTable.$inferSelect;
