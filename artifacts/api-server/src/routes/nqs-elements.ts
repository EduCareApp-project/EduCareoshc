import { Router, type IRouter } from "express";
import { eq, isNull, and } from "drizzle-orm";
import { db, nqsElementsTable } from "@workspace/db";
import {
  ListNqsElementsResponse,
  CreateNqsElementBody,
  UpdateNqsElementParams,
  UpdateNqsElementBody,
  UpdateNqsElementResponse,
  DeleteNqsElementParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_ELEMENTS: { code: string; label: string; descriptor: string; isHeader: boolean; sortOrder: number }[] = [
  // ── Quality Area 1 ────────────────────────────────────────────────────────
  { code: "1.1",   label: "Program",                          descriptor: "The educational program enhances each child's learning and development.",                                                                                                                                                                         isHeader: true,  sortOrder: 10 },
  { code: "1.1.1", label: "Approved learning framework",      descriptor: "Curriculum decision-making contributes to each child's learning and development outcomes in relation to their identity, connection with community, wellbeing, confidence as learners and effectiveness as communicators.",                          isHeader: false, sortOrder: 11 },
  { code: "1.1.2", label: "Child-centred",                   descriptor: "Each child's current knowledge, strengths, ideas, culture, abilities and interests are the foundation of the program.",                                                                                                                            isHeader: false, sortOrder: 12 },
  { code: "1.1.3", label: "Program learning opportunities",  descriptor: "All aspects of the program, including routines, are organised in ways that maximise opportunities for each child's learning.",                                                                                                                     isHeader: false, sortOrder: 13 },
  { code: "1.2",   label: "Practice",                        descriptor: "Educators facilitate and extend each child's learning and development.",                                                                                                                                                                           isHeader: true,  sortOrder: 20 },
  { code: "1.2.1", label: "Intentional teaching",            descriptor: "Educators are deliberate, purposeful, and thoughtful in their decisions and actions.",                                                                                                                                                             isHeader: false, sortOrder: 21 },
  { code: "1.2.2", label: "Responsive teaching and scaffolding", descriptor: "Educators respond to children's ideas and play and extend children's learning through open-ended questions, interactions and feedback.",                                                                                                        isHeader: false, sortOrder: 22 },
  { code: "1.2.3", label: "Child directed learning",         descriptor: "Each child's agency is promoted, enabling them to make choices and decisions that influence events and their world.",                                                                                                                               isHeader: false, sortOrder: 23 },
  { code: "1.3",   label: "Assessment and planning",         descriptor: "Educators and coordinators take a planned and reflective approach to implementing the program for each child.",                                                                                                                                     isHeader: true,  sortOrder: 30 },
  { code: "1.3.1", label: "Assessment and planning cycle",   descriptor: "Each child's learning and development is assessed or evaluated as part of an ongoing cycle of observation, analysing learning, documentation, planning, implementation and reflection.",                                                           isHeader: false, sortOrder: 31 },
  { code: "1.3.2", label: "Critical reflection",             descriptor: "Critical reflection on children's learning and development, both as individuals and in groups, drives program planning and implementation.",                                                                                                        isHeader: false, sortOrder: 32 },
  { code: "1.3.3", label: "Information for families",        descriptor: "Families are informed about the program and their children's progress.",                                                                                                                                                                           isHeader: false, sortOrder: 33 },

  // ── Quality Area 2 ────────────────────────────────────────────────────────
  { code: "2.1",   label: "Health",                          descriptor: "Each child's health and physical activity is supported and promoted.",                                                                                                                                                                             isHeader: true,  sortOrder: 40 },
  { code: "2.1.1", label: "Wellbeing and comfort",           descriptor: "Each child's wellbeing and comfort is provided for, including appropriate opportunities to meet each child's need for sleep, rest and relaxation.",                                                                                                 isHeader: false, sortOrder: 41 },
  { code: "2.1.2", label: "Health practices and procedures", descriptor: "Effective illness and injury management and hygiene practices are promoted and implemented.",                                                                                                                                                       isHeader: false, sortOrder: 42 },
  { code: "2.1.3", label: "Healthy lifestyle",               descriptor: "Healthy eating and physical activity are promoted and appropriate for each child.",                                                                                                                                                                isHeader: false, sortOrder: 43 },
  { code: "2.2",   label: "Safety",                          descriptor: "Each child is protected.",                                                                                                                                                                                                                        isHeader: true,  sortOrder: 50 },
  { code: "2.2.1", label: "Supervision",                     descriptor: "At all times, reasonable precautions and adequate supervision ensure children are protected from harm and hazard.",                                                                                                                                 isHeader: false, sortOrder: 51 },
  { code: "2.2.2", label: "Incident and emergency management", descriptor: "Plans to effectively manage incidents and emergencies are developed in consultation with relevant authorities, practised and implemented.",                                                                                                        isHeader: false, sortOrder: 52 },
  { code: "2.2.3", label: "Child safety and protection",     descriptor: "Management, educators and staff are aware of their roles and responsibilities regarding child safety, including the need to identify and respond to every child at risk of abuse or neglect.",                                                      isHeader: false, sortOrder: 53 },

  // ── Quality Area 3 ────────────────────────────────────────────────────────
  { code: "3.1",   label: "Design",                          descriptor: "The design of the facilities is appropriate for the operation of a service.",                                                                                                                                                                      isHeader: true,  sortOrder: 60 },
  { code: "3.1.1", label: "Fit for purpose",                 descriptor: "Outdoor and indoor spaces, buildings, fixtures and fittings are suitable for their purpose, including supporting the access of every child.",                                                                                                      isHeader: false, sortOrder: 61 },
  { code: "3.1.2", label: "Upkeep",                          descriptor: "Premises, furniture and equipment are safe, clean and well maintained.",                                                                                                                                                                          isHeader: false, sortOrder: 62 },
  { code: "3.2",   label: "Use",                             descriptor: "The service environment is inclusive, promotes competence and supports exploration and play-based learning.",                                                                                                                                       isHeader: true,  sortOrder: 70 },
  { code: "3.2.1", label: "Inclusive environment",           descriptor: "Outdoor and indoor spaces are organised and adapted to support every child's participation and to engage every child in quality experiences in both built and natural environments.",                                                                isHeader: false, sortOrder: 71 },
  { code: "3.2.2", label: "Resources support play-based learning", descriptor: "Resources, materials and equipment allow for multiple uses, are sufficient in number, and enable every child to engage in play-based learning.",                                                                                              isHeader: false, sortOrder: 72 },
  { code: "3.2.3", label: "Environmentally responsible",     descriptor: "The service cares for the environment and supports children to become environmentally responsible.",                                                                                                                                                isHeader: false, sortOrder: 73 },

  // ── Quality Area 4 ────────────────────────────────────────────────────────
  { code: "4.1",   label: "Staffing arrangements",           descriptor: "Staffing arrangements enhance children's learning and development.",                                                                                                                                                                               isHeader: true,  sortOrder: 80 },
  { code: "4.1.1", label: "Organisation of educators",       descriptor: "The organisation of educators across the service supports children's learning and development.",                                                                                                                                                   isHeader: false, sortOrder: 81 },
  { code: "4.1.2", label: "Continuity of staff",             descriptor: "Every effort is made for children to experience continuity of educators at the service.",                                                                                                                                                         isHeader: false, sortOrder: 82 },
  { code: "4.2",   label: "Professionalism",                 descriptor: "Management, educators and staff are collaborative, respectful and ethical.",                                                                                                                                                                       isHeader: true,  sortOrder: 90 },
  { code: "4.2.1", label: "Professional collaboration",      descriptor: "Management, educators and staff work with mutual respect and collaboratively, and challenge and learn from each other, recognising each other's strengths and skills.",                                                                             isHeader: false, sortOrder: 91 },
  { code: "4.2.2", label: "Professional standards",          descriptor: "Professional standards guide practice, interactions and relationships.",                                                                                                                                                                           isHeader: false, sortOrder: 92 },

  // ── Quality Area 5 ────────────────────────────────────────────────────────
  { code: "5.1",   label: "Relationships between educators and children", descriptor: "Respectful and equitable relationships are maintained with each child.",                                                                                                                                                              isHeader: true,  sortOrder: 100 },
  { code: "5.1.1", label: "Positive educator to child interactions", descriptor: "Responsive and meaningful interactions build trusting relationships which engage and support each child to feel secure, confident and included.",                                                                                           isHeader: false, sortOrder: 101 },
  { code: "5.1.2", label: "Dignity and rights of the child", descriptor: "The dignity and rights of every child are maintained.",                                                                                                                                                                                           isHeader: false, sortOrder: 102 },
  { code: "5.2",   label: "Relationships between children",  descriptor: "Each child is supported to build and maintain sensitive and responsive relationships.",                                                                                                                                                            isHeader: true,  sortOrder: 110 },
  { code: "5.2.1", label: "Collaborative learning",          descriptor: "Children are supported to collaborate, learn from and help each other.",                                                                                                                                                                          isHeader: false, sortOrder: 111 },
  { code: "5.2.2", label: "Self-regulation",                 descriptor: "Each child is supported to regulate their own behaviour, respond appropriately to the behaviour of others and communicate effectively to resolve conflicts.",                                                                                       isHeader: false, sortOrder: 112 },

  // ── Quality Area 6 ────────────────────────────────────────────────────────
  { code: "6.1",   label: "Supportive relationships with families", descriptor: "Respectful relationships with families are developed and maintained and families are supported in their parenting role.",                                                                                                                    isHeader: true,  sortOrder: 120 },
  { code: "6.1.1", label: "Engagement with the service",     descriptor: "Families are supported from enrolment to be involved in the service and contribute to service decisions.",                                                                                                                                        isHeader: false, sortOrder: 121 },
  { code: "6.1.2", label: "Parent views are respected",      descriptor: "The expertise, culture, values and beliefs of families are respected, and families share in decision-making about their child's learning and wellbeing.",                                                                                           isHeader: false, sortOrder: 122 },
  { code: "6.1.3", label: "Families are supported",          descriptor: "Current information is available to families about the service and relevant community services and resources to support parenting and family wellbeing.",                                                                                           isHeader: false, sortOrder: 123 },
  { code: "6.2",   label: "Collaborative partnerships",      descriptor: "Collaborative partnerships enhance children's inclusion, learning and wellbeing.",                                                                                                                                                                 isHeader: true,  sortOrder: 130 },
  { code: "6.2.1", label: "Transitions",                     descriptor: "Continuity of learning and transitions for each child are supported by sharing information and clarifying responsibilities.",                                                                                                                      isHeader: false, sortOrder: 131 },
  { code: "6.2.2", label: "Access and participation",        descriptor: "Effective partnerships support children's access, inclusion and participation in the program.",                                                                                                                                                    isHeader: false, sortOrder: 132 },
  { code: "6.2.3", label: "Community engagement",            descriptor: "The service builds relationships and engages with its community.",                                                                                                                                                                                 isHeader: false, sortOrder: 133 },

  // ── Quality Area 7 ────────────────────────────────────────────────────────
  { code: "7.1",   label: "Governance",                      descriptor: "Governance supports the operation of a quality service that is child safe.",                                                                                                                                                                       isHeader: true,  sortOrder: 140 },
  { code: "7.1.1", label: "Service philosophy and purpose",  descriptor: "A statement of philosophy guides all aspects of the service's operations.",                                                                                                                                                                       isHeader: false, sortOrder: 141 },
  { code: "7.1.2", label: "Management systems",              descriptor: "Systems are in place to manage risk and enable the effective management and operation of a quality service that is child safe.",                                                                                                                   isHeader: false, sortOrder: 142 },
  { code: "7.1.3", label: "Roles and responsibilities",      descriptor: "Roles and responsibilities are clearly defined, and understood, and support effective decision making and operation of the service.",                                                                                                               isHeader: false, sortOrder: 143 },
  { code: "7.2",   label: "Leadership",                      descriptor: "Effective leadership builds and promotes a positive organisational culture and professional learning community.",                                                                                                                                   isHeader: true,  sortOrder: 150 },
  { code: "7.2.1", label: "Continuous improvement",          descriptor: "There is an effective self-assessment and quality improvement process in place.",                                                                                                                                                                  isHeader: false, sortOrder: 151 },
  { code: "7.2.2", label: "Educational leadership",          descriptor: "The educational leader is supported and leads the development and implementation of the educational program and assessment and planning cycle.",                                                                                                    isHeader: false, sortOrder: 152 },
  { code: "7.2.3", label: "Development of professionals",    descriptor: "Educators, coordinators and staff members' performance is regularly evaluated, and individual plans are in place to support learning and development.",                                                                                             isHeader: false, sortOrder: 153 },
];

let descriptorsFilled = false;

async function ensureSeeded() {
  const count = await db.$count(nqsElementsTable);
  if (count === 0) {
    await db.insert(nqsElementsTable).values(DEFAULT_ELEMENTS);
    descriptorsFilled = true;
    return;
  }
  // Back-fill descriptors for any existing rows that have them null (e.g. after a schema migration)
  if (!descriptorsFilled) {
    const nullCount = await db.$count(nqsElementsTable, isNull(nqsElementsTable.descriptor));
    if (nullCount > 0) {
      for (const el of DEFAULT_ELEMENTS) {
        await db
          .update(nqsElementsTable)
          .set({ descriptor: el.descriptor })
          .where(and(eq(nqsElementsTable.code, el.code), isNull(nqsElementsTable.descriptor)));
      }
    }
    descriptorsFilled = true;
  }
}

router.get("/nqs-elements", async (req, res): Promise<void> => {
  try {
    await ensureSeeded();
    const elements = await db.select().from(nqsElementsTable).orderBy(nqsElementsTable.sortOrder);
    res.json(ListNqsElementsResponse.parse(elements));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch NQS elements");
    res.status(500).json({ error: "Failed to fetch NQS elements" });
  }
});

router.post("/nqs-elements", async (req, res): Promise<void> => {
  const parsed = CreateNqsElementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { code, label, descriptor, isHeader, sortOrder } = parsed.data;

  try {
    // Auto-calculate sortOrder if not supplied: max of existing elements + 1
    let order = sortOrder;
    if (order == null) {
      const all = await db.select({ sortOrder: nqsElementsTable.sortOrder }).from(nqsElementsTable);
      const max = all.reduce((m, r) => Math.max(m, r.sortOrder), 0);
      order = max + 1;
    }

    const [element] = await db
      .insert(nqsElementsTable)
      .values({ code, label, descriptor: descriptor ?? null, isHeader: isHeader ?? false, sortOrder: order })
      .returning();
    res.status(201).json(element);
  } catch (err) {
    req.log.error({ err }, "Failed to create NQS element");
    res.status(500).json({ error: "Failed to create NQS element" });
  }
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
  try {
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
  } catch (err) {
    req.log.error({ err, elementId: params.data.id }, "Failed to update NQS element");
    res.status(500).json({ error: "Failed to update NQS element" });
  }
});

router.delete("/nqs-elements/:id", async (req, res): Promise<void> => {
  const params = DeleteNqsElementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [element] = await db
      .delete(nqsElementsTable)
      .where(eq(nqsElementsTable.id, params.data.id))
      .returning();
    if (!element) {
      res.status(404).json({ error: "Element not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, elementId: params.data.id }, "Failed to delete NQS element");
    res.status(500).json({ error: "Failed to delete NQS element" });
  }
});

export default router;
