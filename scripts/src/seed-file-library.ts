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
  // ── Operations ──────────────────────────────────────────────────────
  {
    file: "attached_assets/OP-01_EOSHC_Centre_Policies_and_Procedures_2025_v25.2_SOR_Only_1784260192703.pdf",
    displayName: "OP-01 Centre Policies & Procedures 2025",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-02_Enrolment_Form_v6_Print_1784260192703.pdf",
    displayName: "OP-02 Enrolment Form",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-03_MedicationRecord_1784260192703.pdf",
    displayName: "OP-03 Medication Record",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-04_Long_Term_Medications_Form_1784260192703.pdf",
    displayName: "OP-04 Long Term Medications Form",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-07_Individual_Dietary_Form_1784260192703.pdf",
    displayName: "OP-07 Individual Dietary Form",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-11_RP_Diary_Holiday_Program_1784260192704.pdf",
    displayName: "OP-11 RP Diary – Holiday Program",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-12_Incident,_injury,_trauma_and_illness_record_Butler_Versi_1784260192704.pdf",
    displayName: "OP-12 Incident, Injury, Trauma & Illness Record",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-13_Blank_Weekly_Rolls_1784260192704.pdf",
    displayName: "OP-13 Blank Weekly Rolls",
    category: "Operations",
  },
  {
    file: "attached_assets/OP-15_Emergency-Evacuation-Rehearsal-Record_1784260192704.pdf",
    displayName: "OP-15 Emergency Evacuation Rehearsal Record",
    category: "Operations",
  },
  // ── Program & Planning ──────────────────────────────────────────────
  {
    file: "attached_assets/PA-03_Activity_Evaluation_1784260192704.pdf",
    displayName: "PA-03 Activity Evaluation",
    category: "Program & Planning",
  },
  {
    file: "attached_assets/PA-04_Observation-Record-OSHC_v2_1784260192704.pdf",
    displayName: "PA-04 Observation Record",
    category: "Program & Planning",
  },
  {
    file: "attached_assets/PA-06_Child_Profile_1784260192704.pdf",
    displayName: "PA-06 Child Profile",
    category: "Program & Planning",
  },
  // ── Verification Records ────────────────────────────────────────────
  {
    file: "attached_assets/VR-01_Guild_P00044609_CertificateOfCurrencyLiability_1784260192704.pdf",
    displayName: "VR-01 Certificate of Currency – Liability Insurance",
    category: "Verification Records",
  },
  {
    file: "attached_assets/VR-02_Work_Cover_CoC_2025-26_1784260192705.pdf",
    displayName: "VR-02 WorkCover Certificate of Currency 2025–26",
    category: "Verification Records",
  },
  {
    file: "attached_assets/VR-03_Provider_approval_and_certificate_ELYSIUM_BRANDS_PTY._LT_1784260192705.pdf",
    displayName: "VR-03 Provider Approval Certificate",
    category: "Verification Records",
  },
];

async function main() {
  const client = await pool.connect();
  try {
    const hrId  = await ensureCategory(client, "Human Resources",    10);
    const opId  = await ensureCategory(client, "Operations",         20);
    const paId  = await ensureCategory(client, "Program & Planning", 30);
    const vrId  = await ensureCategory(client, "Verification Records", 40);

    const catMap: Record<string, number> = {
      "Human Resources":      hrId,
      "Operations":           opId,
      "Program & Planning":   paId,
      "Verification Records": vrId,
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
