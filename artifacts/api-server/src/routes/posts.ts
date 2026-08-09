import { Router, type IRouter } from "express";
import { createNotification } from "../lib/notify";
import { logger } from "../lib/logger";
import { eq, and, isNotNull, isNull, inArray, sql, desc } from "drizzle-orm";
import { db, postsTable, postCommentsTable, postLikesTable, childrenTable, staffTable, sitesTable, parentAccountsTable } from "@workspace/db";
import {
  CreatePostBody, GetPostParams, GetPostResponse,
  UpdatePostParams, UpdatePostBody, UpdatePostResponse,
  DeletePostParams, ListPostsResponse, ListPostsQueryParams,
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
  try {
    const parsed = ListPostsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid pagination parameters" });
      return;
    }
    const { limit, offset } = parsed.data;

    const likerId = sessionLikerId(req);
    const baseQuery = db.select().from(postsTable).orderBy(desc(postsTable.createdAt));
    const rows = await (
      limit !== undefined && offset !== undefined ? baseQuery.limit(limit).offset(offset) :
      limit !== undefined ? baseQuery.limit(limit) :
      offset !== undefined ? baseQuery.offset(offset) :
      baseQuery
    );

    if (rows.length === 0) {
      res.json(ListPostsResponse.parse([]));
      return;
    }

    // Collect the FK IDs that appear in this page so all sub-queries are bounded
    const postIds = rows.map((p) => p.id);
    const childIds = [...new Set(rows.flatMap((p) => p.childIds ?? []))];
    const staffIds = [...new Set(rows.map((p) => p.staffId).filter((id): id is number => id != null))];
    const siteIds  = [...new Set(rows.map((p) => p.siteId).filter((id): id is number => id != null))];

    // Likes: count + current-user flag per post — scoped to this page's post IDs
    const likesForPage = postIds.length > 0
      ? await db.select().from(postLikesTable).where(inArray(postLikesTable.postId, postIds))
      : [];

    const [childList, staffList, siteList] = await Promise.all([
      childIds.length > 0 ? db.select().from(childrenTable).where(inArray(childrenTable.id, childIds)) : [],
      staffIds.length > 0 ? db.select().from(staffTable).where(inArray(staffTable.id, staffIds)) : [],
      siteIds.length  > 0 ? db.select().from(sitesTable).where(inArray(sitesTable.id, siteIds)) : [],
    ]);

    const likeCountMap = new Map<number, number>();
    const likedByMeSet = new Set<number>();
    for (const like of likesForPage) {
      likeCountMap.set(like.postId, (likeCountMap.get(like.postId) ?? 0) + 1);
      if (
        likerId != null && (
          ("staffId" in likerId && like.staffId === likerId.staffId) ||
          ("guardianEmail" in likerId && like.guardianEmail === likerId.guardianEmail)
        )
      ) {
        likedByMeSet.add(like.postId);
      }
    }

    const enriched = rows.map((p) => {
      const staff = staffList.find((s) => s.id === p.staffId);
      const site  = siteList.find((s) => s.id === p.siteId);
      const childNames = (p.childIds ?? []).map((cid) => {
        const c = childList.find((ch) => ch.id === cid);
        return c ? `${c.firstName} ${c.lastName}` : null;
      }).filter(Boolean) as string[];
      return {
        ...p,
        childNames,
        staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
        siteName: site ? site.name : null,
        likeCount: likeCountMap.get(p.id) ?? 0,
        likedByMe: likedByMeSet.has(p.id),
      };
    });
    res.json(ListPostsResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch posts");
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.post("/posts", async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!(parsed.data as any).siteId) { res.status(400).json({ error: "Site is required" }); return; }

  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.get("/posts/:id", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, params.data.id));
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    res.json(GetPostResponse.parse(await enrichPost(post, sessionLikerId(req))));
  } catch (err) {
    req.log.error({ err, postId: params.data.id }, "Failed to fetch post");
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

router.patch("/posts/:id", async (req, res): Promise<void> => {
  const params = UpdatePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const { notifyGuardians, ...updateData } = parsed.data as any;

    const [existing] = await db.select().from(postsTable).where(eq(postsTable.id, params.data.id));
    if (!existing) { res.status(404).json({ error: "Post not found" }); return; }

    const [post] = await db.update(postsTable).set({ ...updateData, date: updateData.date as any } as any).where(eq(postsTable.id, params.data.id)).returning();
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }

    const wasPublished = existing.publishedAt == null && post.publishedAt != null;
    const taggedChildIds = Array.isArray(post.childIds) ? (post.childIds as number[]) : [];
    // Notification requires a site AND at least one tagged child.
    // Without both we cannot reliably scope recipients, so we skip silently.
    if (wasPublished && notifyGuardians !== false && await isEmailChannelEnabled("guardian_post") && post.siteId && taggedChildIds.length > 0) {
      // Collect guardian emails directly from the tagged children's records.
      // Both guardian 1 and guardian 2 emails are included; no portal account required.
      const taggedChildren = await db
        .select({ guardianEmail: childrenTable.guardianEmail, guardian2Email: childrenTable.guardian2Email })
        .from(childrenTable)
        .where(and(
          inArray(childrenTable.id, taggedChildIds),
          eq(childrenTable.status, "active"),
          eq(childrenTable.siteId, post.siteId),
        ));

      const recipients = [
        ...new Set(
          taggedChildren.flatMap((c) => [c.guardianEmail, c.guardian2Email]).filter((e): e is string => !!e),
        ),
      ];
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
  } catch (err) {
    req.log.error({ err, postId: params.data.id }, "Failed to update post");
    res.status(500).json({ error: "Failed to update post" });
  }
});

router.delete("/posts/:id", async (req, res): Promise<void> => {
  const params = DeletePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const [post] = await db.delete(postsTable).where(eq(postsTable.id, params.data.id)).returning();
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, postId: params.data.id }, "Failed to delete post");
    res.status(500).json({ error: "Failed to delete post" });
  }
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
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, postId: params.data.id }, "Failed to like post");
    res.status(500).json({ error: "Failed to like post" });
  }
});

router.delete("/posts/:id/like", async (req, res): Promise<void> => {
  const params = UnlikePostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const likerId = sessionLikerId(req);
  if (!likerId) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
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
  } catch (err) {
    req.log.error({ err, postId: params.data.id }, "Failed to unlike post");
    res.status(500).json({ error: "Failed to unlike post" });
  }
});

router.get("/posts/:id/comments", async (req, res): Promise<void> => {
  const params = ListPostCommentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const rows = await db.select().from(postCommentsTable)
      .where(eq(postCommentsTable.postId, params.data.id))
      .orderBy(postCommentsTable.createdAt);
    res.json(ListPostCommentsResponse.parse(rows));
  } catch (err) {
    req.log.error({ err, postId: params.data.id }, "Failed to fetch post comments");
    res.status(500).json({ error: "Failed to fetch post comments" });
  }
});

router.post("/posts/:id/comments", async (req, res): Promise<void> => {
  const params = CreatePostCommentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = CreatePostCommentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  try {
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
  } catch (err) {
    req.log.error({ err, postId: params.data.id }, "Failed to create post comment");
    res.status(500).json({ error: "Failed to create post comment" });
  }
});

router.delete("/posts/:id/comments/:commentId", async (req, res): Promise<void> => {
  const params = DeletePostCommentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    await db.delete(postCommentsTable).where(
      and(eq(postCommentsTable.id, params.data.commentId), eq(postCommentsTable.postId, params.data.id))
    );
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, postId: params.data.id, commentId: params.data.commentId }, "Failed to delete post comment");
    res.status(500).json({ error: "Failed to delete post comment" });
  }
});

export default router;
