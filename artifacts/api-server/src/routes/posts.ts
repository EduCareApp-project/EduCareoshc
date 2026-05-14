import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, postsTable, childrenTable, staffTable, sitesTable } from "@workspace/db";
import {
  CreatePostBody, GetPostParams, GetPostResponse,
  UpdatePostParams, UpdatePostBody, UpdatePostResponse,
  DeletePostParams, ListPostsResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

async function enrichPost(p: typeof postsTable.$inferSelect) {
  const [childList, staffList, siteList] = await Promise.all([
    db.select().from(childrenTable),
    db.select().from(staffTable),
    db.select().from(sitesTable),
  ]);
  const child = childList.find((c) => c.id === p.childId);
  const staff = staffList.find((s) => s.id === p.staffId);
  const site = siteList.find((s) => s.id === p.siteId);
  return {
    ...p,
    childName: child ? `${child.firstName} ${child.lastName}` : null,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
    siteName: site ? site.name : null,
  };
}

async function generateAiSummary(title: string, description?: string, learning?: string): Promise<string | null> {
  const text = [description, learning].filter(Boolean).join(" ").replace(/<[^>]*>/g, "").trim();
  if (!text) return null;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for an early childhood education centre. Write a warm, engaging 1-2 sentence summary of a learning observation post for display on a tile card. Be concise and positive.",
        },
        {
          role: "user",
          content: `Post title: "${title}"\n\n${text.slice(0, 800)}`,
        },
      ],
      max_tokens: 80,
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

router.get("/posts", async (_req, res): Promise<void> => {
  const rows = await db.select().from(postsTable).orderBy(postsTable.createdAt);
  const [childList, staffList, siteList] = await Promise.all([
    db.select().from(childrenTable),
    db.select().from(staffTable),
    db.select().from(sitesTable),
  ]);
  const enriched = rows.map((p) => {
    const child = childList.find((c) => c.id === p.childId);
    const staff = staffList.find((s) => s.id === p.staffId);
    const site = siteList.find((s) => s.id === p.siteId);
    return {
      ...p,
      childName: child ? `${child.firstName} ${child.lastName}` : null,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
      siteName: site ? site.name : null,
    };
  });
  res.json(ListPostsResponse.parse(enriched));
});

router.post("/posts", async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const aiSummary = await generateAiSummary(
    parsed.data.title,
    parsed.data.description,
    parsed.data.learning,
  );

  const [post] = await db.insert(postsTable).values({
    ...parsed.data,
    date: parsed.data.date as any,
    images: parsed.data.images ?? [],
    aiSummary,
  }).returning();
  res.status(201).json(GetPostResponse.parse(await enrichPost(post)));
});

router.get("/posts/:id", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, params.data.id));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(GetPostResponse.parse(await enrichPost(post)));
});

router.patch("/posts/:id", async (req, res): Promise<void> => {
  const params = UpdatePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [post] = await db.update(postsTable).set({ ...parsed.data, date: parsed.data.date as any } as any).where(eq(postsTable.id, params.data.id)).returning();
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(UpdatePostResponse.parse(await enrichPost(post)));
});

router.delete("/posts/:id", async (req, res): Promise<void> => {
  const params = DeletePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [post] = await db.delete(postsTable).where(eq(postsTable.id, params.data.id)).returning();
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.sendStatus(204);
});

export default router;
