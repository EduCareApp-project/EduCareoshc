import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { childrenTable } from "./children";
import { staffTable } from "./staff";

export const confidentialNotesTable = pgTable("confidential_notes", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
