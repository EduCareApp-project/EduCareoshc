import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, postsTable, childrenTable, staffTable } from "@workspace/db";
import {
  CreatePostBody, GetPostParams, GetPostResponse,
  UpdatePostParams, UpdatePostBody, UpdatePostResponse,
  DeletePostParams, ListPostsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichPost(p: typeof postsTable.$inferSelect) {
  const childList = await db.select().from(childrenTable);
  const staffList = await db.select().from(staffTable);
  const child = childList.find((c) => c.id === p.childId);
  const staff = staffList.find((s) => s.id === p.staffId);
  return {
    ...p,
    childName: child ? `${child.firstName} ${child.lastName}` : null,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
  };
}

router.get("/posts", async (_req, res): Promise<void> => {
  const rows = await db.select().from(postsTable).orderBy(postsTable.createdAt);
  const childList = await db.select().from(childrenTable);
  const staffList = await db.select().from(staffTable);
  const enriched = rows.map((p) => {
    const child = childList.find((c) => c.id === p.childId);
    const staff = staffList.find((s) => s.id === p.staffId);
    return { ...p, childName: child ? `${child.firstName} ${child.lastName}` : null, staffName: staff ? `${staff.firstName} ${staff.lastName}` : null };
  });
  res.json(ListPostsResponse.parse(enriched));
});

router.post("/posts", async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [post] = await db.insert(postsTable).values(parsed.data).returning();
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
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "published" && !parsed.data.publishedAt) {
    updateData.publishedAt = new Date();
  }
  const [post] = await db.update(postsTable).set(updateData as any).where(eq(postsTable.id, params.data.id)).returning();
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
