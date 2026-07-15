import { Router, type IRouter } from "express";
import { createNotification } from "../lib/notify";
import { logger } from "../lib/logger";
import { eq, and, isNotNull, isNull, sql } from "drizzle-orm";
import { db, postsTable, postCommentsTable, postLikesTable, childrenTable, staffTable, sitesTable, parentAccountsTable } from "@workspace/db";
import {
  CreatePostBody, GetPostParams, GetPostResponse,
  UpdatePostParams, UpdatePostBody, UpdatePostResponse,
  DeletePostParams, ListPostsResponse,
  ListPostCommentsParams, ListPostCommentsResponse,
  CreatePostCommentParams, CreatePostCommentBody,
  DeletePostCommentParams,
  LikePostParams, UnlikePostParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { sendPostNotificationEmail } from "../lib/email";
import { isEmailChannelEnabled } from "../lib/channelMap";
import { getEmailBranding } from "../lib/emailBranding";
import { getAppUrl } from "../lib/appUrl";

const router: IRouter = Router();

type LikerId = { staffId: number } | { guardianEmail: string } | null;

async function enrichPost(p: typeof postsTable.$inferSelect, likerId: LikerId = null) {
  const [childList, staffList, siteList, likes] = await Promise.all([
    db.select().from(childrenTable),
    db.select().from(staffTable),
    db.select().from(sitesTable),
    db.select().from(postLikesTable).where(eq(postLikesTable.postId, p.id)),
  ]);
  const staff = staffList.find((s) => s.id === p.staffId);
  const site = siteList.find((s) => s.id === p.siteId);
  const childNames = (p.childIds ?? []).map((cid) => {
    const c = childList.find((ch) => ch.id === cid);
    return c ? `${c.firstName} ${c.lastName}` : null;
  }).filter(Boolean) as string[];

  const likeCount = likes.length;
  const likedByMe = likerId != null && likes.some((l) =>
    "staffId" in likerId
      ? l.staffId === likerId.staffId
      : l.guardianEmail === likerId.guardianEmail
  );

  return {
    ...p,
    childNames,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
    siteName: site ? site.name : null,
    likeCount,
    likedByMe,
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
        { role: "user", content: `Title: ${title}\n\n${text}` },
      ],
      max_tokens: 80,
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

function sessionLikerId(req: import("express").Request): LikerId {
  const user = req.session?.user;
  if (!user) return null;
  if (user.type === "staff") return { staffId: user.id };
  if (user.type === "guardian") return { guardianEmail: user.email };
  return null;
}

router.get("/posts", async (req, res): Promise<void> => {
  const likerId = sessionLikerId(req);
  const rows = await db.select().from(postsTable).orderBy(postsTable.createdAt);
  const [childList, staffList, siteList, allLikes] = await Promise.all([
    db.select().from(childrenTable),
    db.select().from(staffTable),
    db.select().from(sitesTable),
    db.select().from(postLikesTable),
  ]);

  const likeCountMap = new Map<number, number>();
  for (const like of allLikes) {
    likeCountMap.set(like.postId, (likeCountMap.get(like.postId) ?? 0) + 1);
  }

  const enriched = rows.map((p) => {
    const staff = staffList.find((s) => s.id === p.staffId);
    const site = siteList.find((s) => s.id === p.siteId);
    const childNames = (p.childIds ?? []).map((cid) => {
      const c = childList.find((ch) => ch.id === cid);
      return c ? `${c.firstName} ${c.lastName}` : null;
    }).filter(Boolean) as string[];
    const likesForPost = allLikes.filter((l) => l.postId === p.id);
    const likeCount = likeCountMap.get(p.id) ?? 0;
    const likedByMe = likerId != null && likesForPost.some((l) =>
      "staffId" in likerId
        ? l.staffId === likerId.staffId
        : l.guardianEmail === likerId.guardianEmail
    );
    return {
      ...p,
      childNames,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
      siteName: site ? site.name : null,
      likeCount,
      likedByMe,
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

  const { notifyGuardians: _notifyGuardians, ...postData } = parsed.data as any;

  const [post] = await db.insert(postsTable).values({
    ...postData,
    date: postData.date as any,
    images: postData.images ?? [],
    childIds: postData.childIds ?? [],
    aiSummary,
  }).returning();
  res.status(201).json(GetPostResponse.parse(await enrichPost(post, sessionLikerId(req))));
});

router.get("/posts/:id", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, params.data.id));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(GetPostResponse.parse(await enrichPost(post, sessionLikerId(req))));
});

router.patch("/posts/:id", async (req, res): Promise<void> => {
  const params = UpdatePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { notifyGuardians, ...updateData } = parsed.data as any;

  const [existing] = await db.select().from(postsTable).where(eq(postsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Post not found" }); return; }

  const [post] = await db.update(postsTable).set({ ...updateData, date: updateData.date as any } as any).where(eq(postsTable.id, params.data.id)).returning();
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const wasPublished = existing.publishedAt == null && post.publishedAt != null;
  if (wasPublished && notifyGuardians !== false && await isEmailChannelEnabled("guardian_post")) {
    const childJoinConditions = [
      eq(childrenTable.guardianEmail, parentAccountsTable.guardianEmail),
      eq(childrenTable.status, "active"),
      ...(post.siteId ? [eq(childrenTable.siteId, post.siteId)] : []),
    ];

    const guardians = await db
      .selectDistinct({ email: parentAccountsTable.guardianEmail })
      .from(parentAccountsTable)
      .innerJoin(childrenTable, and(...childJoinConditions))
      .where(
        and(
          isNotNull(parentAccountsTable.passwordHash),
          isNull(parentAccountsTable.blockedAt),
        ),
      );

    const recipients = guardians.map((g) => g.email);
    const plainText = ((post.description ?? post.learning ?? "") as string)
      .replace(/<[^>]*>/g, "")
      .trim();
    const lines = plainText.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
    const excerpt = lines.length > 0
      ? lines.slice(0, 3).join("\n") || null
      : (plainText.slice(0, 250) || null);

    const images: string[] = Array.isArray((post as any).images) ? (post as any).images : [];
    const firstImage = images[0] ?? null;
    const appUrl = getAppUrl();
    const firstImageUrl = firstImage
      ? `${appUrl}/api/storage/objects/${firstImage.replace(/^\/objects\//, "")}`
      : null;

    const portalUrl = `${appUrl}/notices`;

    getEmailBranding().then((branding) =>
      sendPostNotificationEmail(recipients, { postTitle: post.title, excerpt, portalUrl, firstImageUrl }, branding)
    ).catch((err) => {
      req.log.error({ err }, "Post notification email dispatch failed");
    });
  }

  res.json(UpdatePostResponse.parse(await enrichPost(post, sessionLikerId(req))));
});

router.delete("/posts/:id", async (req, res): Promise<void> => {
  const params = DeletePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [post] = await db.delete(postsTable).where(eq(postsTable.id, params.data.id)).returning();
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.sendStatus(204);
});

router.post("/posts/:id/like", async (req, res): Promise<void> => {
  const params = LikePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const likerId = sessionLikerId(req);
  if (!likerId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    if ("staffId" in likerId) {
      await db.insert(postLikesTable).values({ postId: params.data.id, staffId: likerId.staffId }).onConflictDoNothing();
    } else {
      await db.insert(postLikesTable).values({ postId: params.data.id, guardianEmail: likerId.guardianEmail }).onConflictDoNothing();
    }
  } catch {
  }
  res.sendStatus(204);
});

router.delete("/posts/:id/like", async (req, res): Promise<void> => {
  const params = UnlikePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const likerId = sessionLikerId(req);
  if (!likerId) { res.status(401).json({ error: "Not authenticated" }); return; }

  if ("staffId" in likerId) {
    await db.delete(postLikesTable).where(
      and(eq(postLikesTable.postId, params.data.id), eq(postLikesTable.staffId, likerId.staffId))
    );
  } else {
    await db.delete(postLikesTable).where(
      and(eq(postLikesTable.postId, params.data.id), eq(postLikesTable.guardianEmail, likerId.guardianEmail))
    );
  }
  res.sendStatus(204);
});

router.get("/posts/:id/comments", async (req, res): Promise<void> => {
  const params = ListPostCommentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(postCommentsTable)
    .where(eq(postCommentsTable.postId, params.data.id))
    .orderBy(postCommentsTable.createdAt);
  res.json(ListPostCommentsResponse.parse(rows));
});

router.post("/posts/:id/comments", async (req, res): Promise<void> => {
  const params = CreatePostCommentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = CreatePostCommentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [comment] = await db.insert(postCommentsTable).values({
    postId: params.data.id,
    authorName: body.data.authorName,
    body: body.data.body,
  }).returning();

  const [post] = await db.select({ staffId: postsTable.staffId, title: postsTable.title })
    .from(postsTable).where(eq(postsTable.id, params.data.id));
  if (post?.staffId) {
    createNotification({
      staffId: post.staffId,
      type: "post_comment",
      title: `New comment on "${post.title}"`,
      body: body.data.authorName ? `${body.data.authorName}: ${body.data.body}` : body.data.body,
      href: `/posts/${params.data.id}`,
      referenceId: params.data.id,
      referenceType: "post",
    }).catch((err) => logger.warn({ err }, "Failed to send post_comment notification"));
  }

  res.status(201).json(comment);
});

router.delete("/posts/:id/comments/:commentId", async (req, res): Promise<void> => {
  const params = DeletePostCommentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(postCommentsTable).where(
    and(eq(postCommentsTable.id, params.data.commentId), eq(postCommentsTable.postId, params.data.id))
  );
  res.sendStatus(204);
});

export default router;
