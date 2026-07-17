import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import { Storage } from "@google-cloud/storage";

const { Pool } = pg;

const REPLIT_SIDECAR = "http://127.0.0.1:1106";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const gcsClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parseObjectPath(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

function contentTypeForPath(localPath: string): string {
  if (localPath.endsWith(".pdf")) return "application/pdf";
  if (localPath.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

async function uploadFile(localPath: string): Promise<string> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");
  const uuid = randomUUID();
  const fullPath = `${privateDir}/uploads/${uuid}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const buf = readFileSync(localPath);
  await gcsClient.bucket(bucketName).file(objectName).save(buf, {
    contentType: contentTypeForPath(localPath),
  });
  return `/objects/uploads/${uuid}`;
}

async function ensureCategory(client: pg.PoolClient, name: string, sortOrder: number): Promise<number> {
  const existing = await client.query(
    `SELECT id FROM file_categories WHERE name = $1 LIMIT 1`,
    [name]
  );
  if (existing.rows.length > 0) return existing.rows[0].id as number;
  const res = await client.query(
    `INSERT INTO file_categories (name, sort_order) VALUES ($1, $2) RETURNING id`,
    [name, sortOrder]
  );
  return res.rows[0].id as number;
}

async function addToLibrary(
  client: pg.PoolClient,
  opts: { name: string; docName: string; docPath: string; categoryId: number; position: number }
) {
  await client.query(
    `INSERT INTO file_library (name, document_path, document_name, category_id, site_id, position)
     VALUES ($1, $2, $3, $4, NULL, $5)
     ON CONFLICT DO NOTHING`,
    [opts.name, opts.docPath, opts.docName, opts.categoryId, opts.position]
  );
}

const ROOT = resolve(new URL(".", import.meta.url).pathname, "../..");

const DOCS: { file: string; displayName: string; category: string }[] = [
  {
    file: "attached_assets/HR-02_EOSHC_Pay_Guide_2025_1784260122506.pdf",
    displayName: "HR-02 Pay Guide 2025",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-04_Position_Description_-_Coordinator_1784260122507.pdf",
    displayName: "HR-04 Position Description – Program Coordinator",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-05_Position_Description_-_Assistant(s)_1784260122507.pdf",
    displayName: "HR-05 Position Description – Program Assistant",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-08_DET_Staff_Record_v2_1784260122507.pdf",
    displayName: "HR-08 Staff Record",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-09_NS01_NominatedSupervisorConsentForm_v5_1784260122507.pdf",
    displayName: "HR-09 Nominated Supervisor Consent Form",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-10_Responsible_Person_Declaration_1784260122507.pdf",
    displayName: "HR-10 Responsible Person Declaration",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-11_TFN-declaration-form_1784260122507.pdf",
    displayName: "HR-11 TFN Declaration Form",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-12_Superannuation_Form_1784260122507.pdf",
    displayName: "HR-12 Superannuation Choice Form",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-13_Workplace_relations_fact_sheet_1784260122507.pdf",
    displayName: "HR-13 Workplace Relations Fact Sheet",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-14_Fair-Work-Information-Statement_1784260122507.pdf",
    displayName: "HR-14 Fair Work Information Statement",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-18_ComplianceHistoryStatementForAPersonToBeAPersonInDaytoDa_1784260122507.pdf",
    displayName: "HR-18 Compliance History Statement",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-21_Staff_Handbook_OSHC_v2_100722_1784260122507.pdf",
    displayName: "HR-21 Staff Handbook",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-22_QA4_Code_of_Conduct_Staff_Acknowledgement_OSHC_V1_1784260122508.pdf",
    displayName: "HR-22 Code of Conduct & Staff Acknowledgement",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-23_EOSHC_Staff_Policies_2019_1784260122508.pdf",
    displayName: "HR-23 Staff Policies Manual",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-24_Workplace_Injury_Form_-_Staff_1784260122508.pdf",
    displayName: "HR-24 Workplace Injury Form – Staff",
    category: "Human Resources",
  },
];

async function main() {
  const client = await pool.connect();
  try {
    const hrId  = await ensureCategory(client, "Human Resources",    10);
    const opId  = await ensureCategory(client, "Operations",         20);
    const paId  = await ensureCategory(client, "Program & Planning", 30);

    const catMap: Record<string, number> = {
      "Human Resources":    hrId,
      "Operations":         opId,
      "Program & Planning": paId,
    };

    // Seed position counters from current DB max so new docs append correctly
    const maxRes = await client.query<{ category_id: number; max: number }>(
      `SELECT category_id, COALESCE(MAX(position), -1) AS max FROM file_library
       WHERE site_id IS NULL GROUP BY category_id`
    );
    const positionCounters: Record<number, number> = {};
    for (const row of maxRes.rows) {
      positionCounters[row.category_id] = row.max + 1;
    }

    for (const doc of DOCS) {
      const catId = catMap[doc.category]!;
      if (positionCounters[catId] === undefined) positionCounters[catId] = 0;
      const pos = positionCounters[catId]!;

      const localPath = resolve(ROOT, doc.file);
      process.stdout.write(`Uploading ${doc.displayName}… `);
      const objectPath = await uploadFile(localPath);
      process.stdout.write(`stored at ${objectPath}\n`);

      const docName = doc.file.split("/").pop()!;
      await addToLibrary(client, {
        name: doc.displayName,
        docName,
        docPath: objectPath,
        categoryId: catId,
        position: pos,
      });

      positionCounters[catId]!++;
    }

    console.log("Done ✓");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
