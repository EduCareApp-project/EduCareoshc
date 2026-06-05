import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, nqsElementsTable } from "@workspace/db";
import {
  ListNqsElementsResponse,
  UpdateNqsElementParams,
  UpdateNqsElementBody,
  UpdateNqsElementResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_ELEMENTS = [
  // QA1
  { code: "1.1",   label: "Standard 1.1 – Approved learning framework",        isHeader: true,  sortOrder: 10 },
  { code: "1.1.1", label: "Curriculum decision making",                         isHeader: false, sortOrder: 11 },
  { code: "1.1.2", label: "Child's knowledge, ideas and interests",             isHeader: false, sortOrder: 12 },
  { code: "1.1.3", label: "Program maximises learning opportunities",           isHeader: false, sortOrder: 13 },
  { code: "1.2",   label: "Standard 1.2 – Educators facilitate learning",       isHeader: true,  sortOrder: 20 },
  { code: "1.2.1", label: "Deliberate and purposeful decisions",                isHeader: false, sortOrder: 21 },
  { code: "1.2.2", label: "Responsive teaching and scaffolding",                isHeader: false, sortOrder: 22 },
  { code: "1.2.3", label: "Critical reflection informs planning",               isHeader: false, sortOrder: 23 },
  { code: "1.3",   label: "Standard 1.3 – Planned and reflective approach",    isHeader: true,  sortOrder: 30 },
  { code: "1.3.1", label: "Assessment and evaluation cycle",                    isHeader: false, sortOrder: 31 },
  { code: "1.3.2", label: "Critical reflection guides planning",                isHeader: false, sortOrder: 32 },
  { code: "1.3.3", label: "Families informed about program",                    isHeader: false, sortOrder: 33 },
  // QA2
  { code: "2.1",   label: "Standard 2.1 – Each child's health is promoted",    isHeader: true,  sortOrder: 40 },
  { code: "2.1.1", label: "Each child's health needs are supported",            isHeader: false, sortOrder: 41 },
  { code: "2.1.2", label: "Illness, injury and hygiene management",             isHeader: false, sortOrder: 42 },
  { code: "2.1.3", label: "Healthy lifestyle is promoted",                      isHeader: false, sortOrder: 43 },
  { code: "2.2",   label: "Standard 2.2 – Healthy eating and physical activity",isHeader: true,  sortOrder: 50 },
  { code: "2.2.1", label: "Healthy eating is promoted",                         isHeader: false, sortOrder: 51 },
  { code: "2.2.2", label: "Physical activity is promoted",                      isHeader: false, sortOrder: 52 },
  { code: "2.2.3", label: "Community collaboration for health and wellbeing",   isHeader: false, sortOrder: 53 },
  { code: "2.3",   label: "Standard 2.3 – Each child is protected",            isHeader: true,  sortOrder: 60 },
  { code: "2.3.1", label: "Children are adequately supervised",                 isHeader: false, sortOrder: 61 },
  { code: "2.3.2", label: "Children protected from harm and hazards",           isHeader: false, sortOrder: 62 },
  // QA3
  { code: "3.1",   label: "Standard 3.1 – Design of spaces",                   isHeader: true,  sortOrder: 70 },
  { code: "3.1.1", label: "Spaces, furniture and equipment are appropriate",    isHeader: false, sortOrder: 71 },
  { code: "3.1.2", label: "Environment promotes competence and exploration",    isHeader: false, sortOrder: 72 },
  { code: "3.2",   label: "Standard 3.2 – Service environment supports learning",isHeader: true, sortOrder: 80 },
  { code: "3.2.1", label: "Indoor and outdoor spaces engage children",          isHeader: false, sortOrder: 81 },
  { code: "3.2.2", label: "Resources and equipment support learning",           isHeader: false, sortOrder: 82 },
  { code: "3.2.3", label: "Environment is inclusive and promotes independence", isHeader: false, sortOrder: 83 },
  // QA4
  { code: "4.1",   label: "Standard 4.1 – Staffing arrangements",              isHeader: true,  sortOrder: 90 },
  { code: "4.1.1", label: "Educators recruited with skills and qualifications", isHeader: false, sortOrder: 91 },
  { code: "4.1.2", label: "Continuing professional learning",                   isHeader: false, sortOrder: 92 },
  { code: "4.2",   label: "Standard 4.2 – Collaborative, respectful and ethical",isHeader: true,sortOrder: 100 },
  { code: "4.2.1", label: "Staff work collaboratively with mutual respect",     isHeader: false, sortOrder: 101 },
  { code: "4.2.2", label: "Professional standards guide practice",              isHeader: false, sortOrder: 102 },
  // QA5
  { code: "5.1",   label: "Standard 5.1 – Respectful and equitable relationships",isHeader: true,sortOrder: 110 },
  { code: "5.1.1", label: "Warm, responsive interactions that build trust",     isHeader: false, sortOrder: 111 },
  { code: "5.1.2", label: "Dignity and rights of every child maintained",       isHeader: false, sortOrder: 112 },
  { code: "5.2",   label: "Standard 5.2 – Sensitive and responsive relationships",isHeader: true,sortOrder: 120 },
  { code: "5.2.1", label: "Children supported to collaborate and help each other",isHeader: false,sortOrder: 121 },
  { code: "5.2.2", label: "Children supported to regulate behaviour",           isHeader: false, sortOrder: 122 },
  { code: "5.2.3", label: "Strengths of families and community recognised",     isHeader: false, sortOrder: 123 },
  // QA6
  { code: "6.1",   label: "Standard 6.1 – Relationships with families",        isHeader: true,  sortOrder: 130 },
  { code: "6.1.1", label: "Families supported as primary educators",            isHeader: false, sortOrder: 131 },
  { code: "6.1.2", label: "Family expertise and beliefs are respected",         isHeader: false, sortOrder: 132 },
  { code: "6.1.3", label: "Current information available to families",          isHeader: false, sortOrder: 133 },
  { code: "6.2",   label: "Standard 6.2 – Families supported in parenting role",isHeader: true, sortOrder: 140 },
  { code: "6.2.1", label: "Service supports family involvement",                isHeader: false, sortOrder: 141 },
  { code: "6.2.2", label: "Families have opportunities to contribute",          isHeader: false, sortOrder: 142 },
  { code: "6.3",   label: "Standard 6.3 – Collaboration with other organisations",isHeader: true,sortOrder: 150 },
  { code: "6.3.1", label: "Links with community and support agencies",          isHeader: false, sortOrder: 151 },
  { code: "6.3.2", label: "Service builds community relationships",             isHeader: false, sortOrder: 152 },
  { code: "6.3.3", label: "Service is an active community participant",         isHeader: false, sortOrder: 153 },
  // QA7
  { code: "7.1",   label: "Standard 7.1 – Governance supports quality",        isHeader: true,  sortOrder: 160 },
  { code: "7.1.1", label: "Statement of philosophy guides operations",          isHeader: false, sortOrder: 161 },
  { code: "7.1.2", label: "Management systems meet regulatory requirements",    isHeader: false, sortOrder: 162 },
  { code: "7.1.3", label: "Roles and responsibilities clearly defined",         isHeader: false, sortOrder: 163 },
  { code: "7.2",   label: "Standard 7.2 – Effective leadership",               isHeader: true,  sortOrder: 170 },
  { code: "7.2.1", label: "Self-assessment and quality improvement process",    isHeader: false, sortOrder: 171 },
  { code: "7.2.2", label: "Educational leader effectively supported",           isHeader: false, sortOrder: 172 },
  { code: "7.2.3", label: "Service regularly evaluates and improves",           isHeader: false, sortOrder: 173 },
];

async function ensureSeeded() {
  const count = await db.$count(nqsElementsTable);
  if (count === 0) {
    await db.insert(nqsElementsTable).values(DEFAULT_ELEMENTS);
  }
}

router.get("/nqs-elements", async (_req, res): Promise<void> => {
  await ensureSeeded();
  const elements = await db.select().from(nqsElementsTable).orderBy(nqsElementsTable.sortOrder);
  res.json(ListNqsElementsResponse.parse(elements));
});

router.patch("/nqs-elements/:id", async (req, res): Promise<void> => {
  const params = UpdateNqsElementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateNqsElementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [element] = await db
    .update(nqsElementsTable)
    .set({ label: parsed.data.label })
    .where(eq(nqsElementsTable.id, params.data.id))
    .returning();
  if (!element) {
    res.status(404).json({ error: "Element not found" });
    return;
  }
  res.json(UpdateNqsElementResponse.parse(element));
});

export default router;
