import { defineConfig } from "drizzle-kit";
import path from "path";
import { is, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "./src/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  // Session storage and the private control-plane registry are managed separately.
  tablesFilter: Object.values(schema).filter((value) => is(value, PgTable)).map((table) => getTableName(table)),
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
