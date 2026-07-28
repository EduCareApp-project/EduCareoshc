import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { childrenTable } from "./children";
import { staffTable } from "./staff";

export const childMedicationsTable = pgTable("child_medications", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  slot: integer("slot").notNull(),
  name: text("name").notNull().default(""),
  lastAdministered: text("last_administered"),
  toBeAdministeredBy: text("to_be_administered_by"),
  frequency: text("frequency"),
  administrationTime: text("administration_time"),
  dosage: text("dosage"),
  methodOfAdministration: text("method_of_administration"),
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const medicationLogsTable = pgTable("medication_logs", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").notNull().references(() => childMedicationsTable.id, { onDelete: "cascade" }),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  administeredAt: timestamp("administered_at", { withTimezone: true }).notNull(),
  dosageAdministered: text("dosage_administered").notNull(),
  methodOfAdministration: text("method_of_administration").notNull(),
  administeredById: integer("administered_by_id").notNull().references(() => staffTable.id, { onDelete: "restrict" }),
  witnessId: integer("witness_id").references(() => staffTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChildMedication = typeof childMedicationsTable.$inferSelect;
export type MedicationLog = typeof medicationLogsTable.$inferSelect;
