import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  attachMediaAsset,
  cleanupMediaAssets,
  completeMediaUpload,
  createMediaUploadIntent,
  getAdminMedia,
  getMediaForDelivery,
  listAdminMedia,
  receiveLocalMediaUpload,
  removeMediaAsAdmin,
  removeOwnedMedia,
  updateMediaAltText,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module5.test";
const storageRoot = resolve(".data/test-media-module5");

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const media = await prisma.mediaAsset.findMany({
    where: { ownerId: { in: users.map(({ id }) => id) } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: users.map(({ id }) => id) } },
        {
          entityType: "MediaAsset",
          entityId: { in: media.map(({ id }) => id) },
        },
      ],
    },
  });
  await prisma.mediaAsset.deleteMany({
    where: { id: { in: media.map(({ id }) => id) } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: users.map(({ id }) => id) } },
  });
  await rm(storageRoot, { force: true, recursive: true });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const member = await prisma.user.create({
    data: {
      email: `member-${suffix}@${testDomain}`,
      firstName: "Module5",
      lastName: "Member",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  const stranger = await prisma.user.create({
    data: {
      email: `stranger-${suffix}@${testDomain}`,
      firstName: "Module5",
      lastName: "Stranger",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: `admin-${suffix}@${testDomain}`,
      firstName: "Module5",
      lastName: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const moderator = await prisma.user.create({
    data: {
      email: `moderator-${suffix}@${testDomain}`,
      firstName: "Module5",
      lastName: "Moderator",
      role: "MODERATOR",
      status: "ACTIVE",
    },
  });
  return { member, stranger, admin, moderator };
}

async function imageBytes(color = "#16a34a") {
  return new Uint8Array(
    await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 3,
        background: color,
      },
    })
      .jpeg()
      .toBuffer(),
  );
}

async function uploadImage(input?: {
  purpose?: "PROFILE_AVATAR" | "POST_IMAGE" | "MESSAGE_IMAGE";
  replacesId?: string;
  color?: string;
}) {
  const bytes = await imageBytes(input?.color);
  const intent = await createMediaUploadIntent(fixture.member, {
    purpose: input?.purpose ?? "PROFILE_AVATAR",
    fileName: "avatar.jpg",
    mimeType: "image/jpeg",
    sizeBytes: bytes.byteLength,
    altText: "Portrait of Module 5 member",
    replacesId: input?.replacesId,
  });
  await receiveLocalMediaUpload({
    assetId: intent.media.id,
    uploadToken: intent.upload.headers["X-Kondo-Upload-Token"] ?? null,
    contentType: intent.upload.headers["Content-Type"] ?? null,
    contentLength: bytes.byteLength,
    bytes,
  });
  const media = await completeMediaUpload(fixture.member, intent.media.id);
  return { intent, media };
}

postgresDescribe("Module 5 PostgreSQL media workflow", () => {
  beforeAll(async () => {
    process.env.STORAGE_DRIVER = "local";
    process.env.STORAGE_LOCAL_ROOT = storageRoot;
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module5_fail_media_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module5_fail_media_audit"()',
    );
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module5_fail_media_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module5_fail_media_audit"()',
    );
    await cleanup();
    await prisma.$disconnect();
  });

  it("authorizes a server-keyed upload and activates only validated bytes", async () => {
    const { intent, media } = await uploadImage();
    expect(intent.upload.url).toContain(
      `/api/media/uploads/${media.id}/content`,
    );
    expect(intent.media).not.toHaveProperty("objectKey");
    expect(media).toMatchObject({
      status: "ACTIVE",
      mimeType: "image/jpeg",
      width: 256,
      height: 256,
      altText: "Portrait of Module 5 member",
    });
    const stored = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: media.id },
    });
    expect(stored.objectKey).toMatch(
      new RegExp(`^media/${fixture.member.id}/profile-avatar/`),
    );
    expect(stored.scanStatus).toBe("CLEAN");
    expect(stored.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(
      prisma.auditLog.findFirst({
        where: {
          entityType: "MediaAsset",
          entityId: media.id,
          action: "MEDIA_UPLOAD_ACTIVATED",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("enforces public/private delivery and Admin-only inspection", async () => {
    const publicUpload = await uploadImage({
      purpose: "POST_IMAGE",
      color: "#0ea5e9",
    });
    const privateUpload = await uploadImage({
      purpose: "MESSAGE_IMAGE",
      color: "#7c3aed",
    });
    await expect(
      getMediaForDelivery(publicUpload.media.id, null),
    ).resolves.toMatchObject({ visibility: "PUBLIC" });
    await expect(
      getMediaForDelivery(privateUpload.media.id, fixture.member),
    ).resolves.toMatchObject({ visibility: "PRIVATE" });
    await expect(
      getMediaForDelivery(privateUpload.media.id, fixture.stranger),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      getMediaForDelivery(privateUpload.media.id, fixture.admin),
    ).resolves.toMatchObject({ visibility: "PRIVATE" });
    await expect(listAdminMedia(fixture.moderator, {})).rejects.toMatchObject({
      status: 403,
    });
    const adminResult = await listAdminMedia(fixture.admin, {
      purpose: "MESSAGE_IMAGE",
    });
    expect(adminResult.records[0]).not.toHaveProperty("objectKey");
    await expect(
      getAdminMedia(fixture.admin, privateUpload.media.id),
    ).resolves.toMatchObject({
      media: { id: privateUpload.media.id },
    });
  });

  it("rejects spoofed content and deletes it from delivery", async () => {
    const bytes = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
    );
    const intent = await createMediaUploadIntent(fixture.member, {
      purpose: "PROFILE_AVATAR",
      fileName: "spoofed.jpg",
      mimeType: "image/jpeg",
      sizeBytes: bytes.byteLength,
      altText: "Spoofed member portrait",
    });
    await receiveLocalMediaUpload({
      assetId: intent.media.id,
      uploadToken: intent.upload.headers["X-Kondo-Upload-Token"] ?? null,
      contentType: "image/jpeg",
      contentLength: bytes.byteLength,
      bytes,
    });
    await expect(
      completeMediaUpload(fixture.member, intent.media.id),
    ).rejects.toThrow("does not match its declared MIME");
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: intent.media.id } }),
    ).resolves.toMatchObject({
      status: "REJECTED",
      scanStatus: "ERROR",
      storageDeletePending: false,
    });
    await expect(
      getMediaForDelivery(intent.media.id, fixture.member),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("replaces attached media atomically and preserves attachment identity", async () => {
    const original = await uploadImage({ color: "#f59e0b" });
    await prisma.$transaction((tx) =>
      attachMediaAsset(tx, {
        ownerId: fixture.member.id,
        assetId: original.media.id,
        purpose: "PROFILE_AVATAR",
        attachmentType: "USER_AVATAR",
        attachmentId: fixture.member.id,
      }),
    );
    const replacement = await uploadImage({
      replacesId: original.media.id,
      color: "#ef4444",
    });
    const [oldRow, newRow] = await Promise.all([
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: original.media.id },
      }),
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: replacement.media.id },
      }),
    ]);
    expect(oldRow.status).toBe("REMOVED");
    expect(newRow).toMatchObject({
      status: "ACTIVE",
      attachmentType: "USER_AVATAR",
      attachmentId: fixture.member.id,
    });
  });

  it("supports alt text, owner removal, and forbids cross-owner mutations", async () => {
    const upload = await uploadImage({ color: "#14b8a6" });
    await expect(
      updateMediaAltText(
        fixture.stranger,
        upload.media.id,
        "Unauthorized change",
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateMediaAltText(
        fixture.member,
        upload.media.id,
        "Updated accessible portrait",
      ),
    ).resolves.toMatchObject({ altText: "Updated accessible portrait" });
    await expect(
      removeOwnedMedia(fixture.stranger, upload.media.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      removeOwnedMedia(fixture.member, upload.media.id),
    ).resolves.toEqual({ removed: true });
    await expect(
      getMediaForDelivery(upload.media.id, null),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("keeps Admin removal and its audit atomic", async () => {
    const upload = await uploadImage({ color: "#334155" });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "module5_fail_media_audit"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."action" = 'MEDIA_REMOVED_BY_ADMIN' THEN
          RAISE EXCEPTION 'forced media audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "module5_fail_media_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "module5_fail_media_audit"()
    `);
    await expect(
      removeMediaAsAdmin(
        fixture.admin,
        upload.media.id,
        "Confirmed policy violation in uploaded content.",
      ),
    ).rejects.toThrow();
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: upload.media.id } }),
    ).resolves.toMatchObject({ status: "ACTIVE" });

    await prisma.$executeRawUnsafe(
      'DROP TRIGGER "module5_fail_media_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION "module5_fail_media_audit"()',
    );
    await expect(
      removeMediaAsAdmin(
        fixture.admin,
        upload.media.id,
        "Confirmed policy violation in uploaded content.",
      ),
    ).resolves.toEqual({ removed: true });
    await expect(
      prisma.auditLog.findFirst({
        where: {
          entityId: upload.media.id,
          action: "MEDIA_REMOVED_BY_ADMIN",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("prevents concurrent activation and cleans expired or orphaned media", async () => {
    const bytes = await imageBytes("#a855f7");
    const intent = await createMediaUploadIntent(fixture.member, {
      purpose: "PROFILE_AVATAR",
      fileName: "concurrent.jpg",
      mimeType: "image/jpeg",
      sizeBytes: bytes.byteLength,
      altText: "Concurrent activation portrait",
    });
    await receiveLocalMediaUpload({
      assetId: intent.media.id,
      uploadToken: intent.upload.headers["X-Kondo-Upload-Token"] ?? null,
      contentType: "image/jpeg",
      contentLength: bytes.byteLength,
      bytes,
    });
    const results = await Promise.allSettled([
      completeMediaUpload(fixture.member, intent.media.id),
      completeMediaUpload(fixture.member, intent.media.id),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );

    await prisma.mediaAsset.update({
      where: { id: intent.media.id },
      data: { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    const expiredIntent = await createMediaUploadIntent(fixture.member, {
      purpose: "PROFILE_AVATAR",
      fileName: "expired.jpg",
      mimeType: "image/jpeg",
      sizeBytes: bytes.byteLength,
      altText: "Expired upload portrait",
    });
    await prisma.mediaAsset.update({
      where: { id: expiredIntent.media.id },
      data: { uploadExpiresAt: new Date(Date.now() - 1000) },
    });
    const cleanupResult = await cleanupMediaAssets(new Date(), 100);
    expect(cleanupResult.failed).toBe(0);
    const cleaned = await prisma.mediaAsset.findMany({
      where: { id: { in: [intent.media.id, expiredIntent.media.id] } },
      orderBy: { id: "asc" },
    });
    expect(cleaned.map(({ status }) => status).sort()).toEqual([
      "REJECTED",
      "REMOVED",
    ]);
  });

  it("does not allow a second successful replacement under concurrency", async () => {
    const original = await uploadImage({ color: "#0284c7" });
    const firstBytes = await imageBytes("#65a30d");
    const secondBytes = await imageBytes("#be123c");
    async function prepared(bytes: Uint8Array, name: string) {
      const intent = await createMediaUploadIntent(fixture.member, {
        purpose: "PROFILE_AVATAR",
        fileName: name,
        mimeType: "image/jpeg",
        sizeBytes: bytes.byteLength,
        altText: "Replacement portrait",
        replacesId: original.media.id,
      });
      await receiveLocalMediaUpload({
        assetId: intent.media.id,
        uploadToken: intent.upload.headers["X-Kondo-Upload-Token"] ?? null,
        contentType: "image/jpeg",
        contentLength: bytes.byteLength,
        bytes,
      });
      return intent.media.id;
    }
    const [firstId, secondId] = await Promise.all([
      prepared(firstBytes, "first.jpg"),
      prepared(secondBytes, "second.jpg"),
    ]);
    const results = await Promise.allSettled([
      completeMediaUpload(fixture.member, firstId),
      completeMediaUpload(fixture.member, secondId),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const activeReplacements = await prisma.mediaAsset.count({
      where: {
        replacesId: original.media.id,
        status: "ACTIVE",
      },
    });
    expect(activeReplacements).toBe(1);
  });
});
