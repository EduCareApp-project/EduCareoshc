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

async function uploadFile(localPath: string): Promise<string> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");
  const uuid = randomUUID();
  const fullPath = `${privateDir}/uploads/${uuid}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const buf = readFileSync(localPath);
  await gcsClient.bucket(bucketName).file(objectName).save(buf, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
    file: "attached_assets/HR-16_Annual_Qualification_Review_1784260060004.docx",
    displayName: "HR-16 Annual Qualification Review",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-17_Appraisal_&_Performance_Development_Plan-_Program_Assis_1784260060004.docx",
    displayName: "HR-17 Appraisal & Performance Development Plan – Program Assistant",
    category: "Human Resources",
  },
  {
    file: "attached_assets/HR-19_Interview_questions_for_new_Employees_1784260060004.docx",
    displayName: "HR-19 Interview Questions for New Employees",
    category: "Human Resources",
  },
  {
    file: "attached_assets/OP-05_Medical_Condition_Communication_Plan_-_Sample_1784260060004.docx",
    displayName: "OP-05 Medical Condition Communication Plan – Sample",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-06_Individual_Medical_RISK_Plan_-_Sample_1784260060005.docx",
    displayName: "OP-06 Individual Medical Risk Plan – Sample",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-09_Excursion_Form_Sample_1784260060005.docx",
    displayName: "OP-09 Excursion Form – Sample",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-10_RAM_Sample_1784260060005.docx",
    displayName: "OP-10 Risk Assessment & Management – Sample",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-16_Individual_Safety_Plan_-_Sample_1784260060005.docx",
    displayName: "OP-16 Individual Safety Plan – Sample",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-17_Restorative_Conversations_and_Self_Reflection_Tool_1784260060005.docx",
    displayName: "OP-17 Restorative Conversations & Self Reflection Tool",
    category: "Operations",
  },
  {
    file: "attached_assets/PA-01_Planning_Cycle_v2.3_1784260060005.docx",
    displayName: "PA-01 Planning Cycle v2.3",
    category: "Program & Planning",
  },
  {
    file: "attached_assets/PA-02_MTOP_Experience_Assessment_1784260060005.docx",
    displayName: "PA-02 MTOP Experience Assessment",
    category: "Program & Planning",
  },
  {
    file: "attached_assets/PA-05_10_Week_Plan_1784260060005.docx",
    displayName: "PA-05 10 Week Plan",
    category: "Program & Planning",
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

    const positionCounters: Record<number, number> = {};

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
