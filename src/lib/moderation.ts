import {
  Prisma,
  type ReportDecision,
  type ReportReason,
  type ReportStatus,
} from "@prisma/client";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { writeAuditLogWithClient } from "@/lib/audit";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const ACTIVE_REPORT_STATUSES: ReportStatus[] = ["OPEN", "REVIEWING"];
const TERMINAL_REPORT_STATUSES: ReportStatus[] = ["RESOLVED", "DISMISSED"];
const RESOLVED_DECISIONS: ReportDecision[] = [
  "VIOLATION_CONFIRMED",
  "ESCALATED",
  "OTHER",
];
const DISMISSED_DECISIONS: ReportDecision[] = [
  "NO_VIOLATION",
  "INSUFFICIENT_EVIDENCE",
  "DUPLICATE",
  "OUT_OF_SCOPE",
  "OTHER",
];

export type ModerationActor = {
  id: string;
  role: AppRole | string;
};

export class ModerationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ModerationError";
  }
}

type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ReportListFilters = {
  page?: number;
  pageSize?: number;
  status?: ReportStatus;
  reason?: ReportReason;
  targetType?: string;
  assignee?: string;
  query?: string;
};

type AuditListFilters = {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  actorId?: string;
  query?: string;
};

function clampPage(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value ?? 1)) : 1;
}

function clampPageSize(value: number | undefined) {
  if (!Number.isFinite(value)) return 20;
  return Math.min(50, Math.max(5, Math.floor(value ?? 20)));
}

function safeUser(
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string | null;
    role?: string;
  } | null,
) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    ...(user.role ? { role: user.role } : {}),
    fullName: `${user.firstName} ${user.lastName}`,
  };
}

const moderationUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  role: true,
} satisfies Prisma.UserSelect;

export function canAccessReport(
  actor: ModerationActor,
  report: { assigneeId: string | null },
) {
  if (!hasAdminPermission(actor.role, "REPORT_VIEW")) return false;
  if (hasAdminPermission(actor.role, "REPORT_ASSIGN_ANY")) return true;
  return report.assigneeId === null || report.assigneeId === actor.id;
}

export function validateReportTransition(input: {
  actor: ModerationActor;
  report: {
    status: ReportStatus;
    assigneeId: string | null;
  };
  targetStatus: Exclude<ReportStatus, "OPEN">;
  decision?: ReportDecision;
  resolution?: string;
}) {
  const { actor, report, targetStatus, decision, resolution } = input;
  const canActOnAssigned =
    hasAdminPermission(actor.role, "REPORT_ASSIGN_ANY") ||
    report.assigneeId === actor.id;

  if (
    targetStatus === "REVIEWING" &&
    TERMINAL_REPORT_STATUSES.includes(report.status)
  ) {
    if (!hasAdminPermission(actor.role, "REPORT_REOPEN")) {
      throw new ModerationError("This report cannot be reopened.", 403);
    }
    if (!resolution || resolution.trim().length < 10) {
      throw new ModerationError("A reopening reason is required.", 400);
    }
    return;
  }

  if (!canActOnAssigned || !report.assigneeId) {
    throw new ModerationError(
      "The report must be assigned before it can be updated.",
      403,
    );
  }

  if (report.status === "OPEN" && targetStatus === "REVIEWING") return;

  if (
    report.status !== "REVIEWING" ||
    !TERMINAL_REPORT_STATUSES.includes(targetStatus)
  ) {
    throw new ModerationError("Invalid report status transition.", 409);
  }

  if (!decision || !resolution || resolution.trim().length < 10) {
    throw new ModerationError(
      "A decision and resolution are required to close a report.",
      400,
    );
  }

  const allowedDecisions =
    targetStatus === "RESOLVED" ? RESOLVED_DECISIONS : DISMISSED_DECISIONS;
  if (!allowedDecisions.includes(decision)) {
    throw new ModerationError(
      "The selected decision does not match the final status.",
      400,
    );
  }
}

function reportVisibilityWhere(
  actor: ModerationActor,
): Prisma.ReportWhereInput {
  if (hasAdminPermission(actor.role, "REPORT_ASSIGN_ANY")) return {};
  return {
    OR: [{ assigneeId: null }, { assigneeId: actor.id }],
  };
}

export async function listReports(
  actor: ModerationActor,
  filters: ReportListFilters = {},
) {
  if (!hasAdminPermission(actor.role, "REPORT_LIST")) {
    throw new ModerationError("Access denied.", 403);
  }

  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const where: Prisma.ReportWhereInput = {
    AND: [
      reportVisibilityWhere(actor),
      filters.status ? { status: filters.status } : {},
      filters.reason ? { reason: filters.reason } : {},
      filters.targetType ? { targetType: filters.targetType } : {},
      filters.query
        ? {
            OR: [
              {
                id: {
                  contains: filters.query,
                  mode: "insensitive",
                },
              },
              {
                targetId: {
                  contains: filters.query,
                  mode: "insensitive",
                },
              },
              {
                details: {
                  contains: filters.query,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
    ],
  };

  if (filters.assignee === "unassigned") {
    where.assigneeId = null;
  } else if (filters.assignee === "me") {
    where.assigneeId = actor.id;
  } else if (
    filters.assignee &&
    hasAdminPermission(actor.role, "REPORT_ASSIGN_ANY")
  ) {
    where.assigneeId = filters.assignee;
  }

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        status: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        reporter: { select: moderationUserSelect },
        subjectUser: { select: moderationUserSelect },
        assignee: { select: moderationUserSelect },
        _count: { select: { notes: true, evidence: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    reports: reports.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      status: report.status,
      version: report.version,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      reporter: safeUser(report.reporter),
      subjectUser: safeUser(report.subjectUser),
      assignee: safeUser(report.assignee),
      noteCount: report._count.notes,
      evidenceCount: report._count.evidence,
    })),
  };
}

function sanitizeAuditValue(
  value: Prisma.JsonValue | null | undefined,
): Prisma.JsonValue | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (typeof value !== "object") return value;

  const sensitiveKeys = new Set([
    "password",
    "passwordHash",
    "token",
    "tokenHash",
    "accessToken",
    "refreshToken",
    "idToken",
    "attachmentKey",
  ]);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeys.has(key) ? "[REDACTED]" : sanitizeAuditValue(item),
    ]),
  ) as Prisma.JsonObject;
}

function serializeAuditLog(
  actor: ModerationActor,
  log: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValue: Prisma.JsonValue | null;
    newValue: Prisma.JsonValue | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    actor: {
      id: string;
      firstName: string;
      lastName: string;
      username: string | null;
      role: string;
    } | null;
  },
) {
  const canViewSecurityMetadata = hasAdminPermission(
    actor.role,
    "AUDIT_VIEW_SECURITY_METADATA",
  );
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    oldValue: sanitizeAuditValue(log.oldValue),
    newValue: sanitizeAuditValue(log.newValue),
    actor: safeUser(log.actor),
    createdAt: log.createdAt,
    ipAddress: canViewSecurityMetadata ? log.ipAddress : null,
    userAgent: canViewSecurityMetadata ? log.userAgent : null,
  };
}

type ConversationSnapshot = {
  version: number;
  conversationId: string;
  reporterId: string;
  subjectUserId: string | null;
  participants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    username: string | null;
  }>;
  messages: Array<{
    id: string;
    senderId: string;
    type: string;
    body: string | null;
    attachmentName: string | null;
    attachmentMime: string | null;
    attachmentSize: number | null;
    createdAt: string;
  }>;
};

type ProfileSnapshot = {
  version: number;
  subjectUserId: string;
  firstName: string;
  lastName: string;
  username: string | null;
  bio: string | null;
  avatarMediaId: string | null;
  profileAudience: string;
  profileCreatedAt: string;
};

type CommunityContentSnapshot = {
  version: number;
  targetType: "Community" | "Post" | "Comment";
  targetId: string;
  communityId: string;
  communityName: string;
  postId?: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  title: string | null;
  body: string;
  status: string;
  postType?: string;
  mediaIds: string[];
  createdAt: string;
};

type MarketplaceListingSnapshot = {
  version: number;
  listingId: string;
  sellerId: string;
  sellerName: string;
  sellerUsername: string | null;
  title: string;
  description: string;
  priceFen: number;
  isNegotiable: boolean;
  status: string;
  cityName: string;
  categoryName: string;
  mediaIds: string[];
  createdAt: string;
};

function parseConversationSnapshot(
  value: Prisma.JsonValue,
): ConversationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, Prisma.JsonValue>;
  if (
    typeof snapshot.conversationId !== "string" ||
    typeof snapshot.reporterId !== "string" ||
    !Array.isArray(snapshot.participants) ||
    !Array.isArray(snapshot.messages)
  ) {
    return null;
  }
  return value as unknown as ConversationSnapshot;
}

function parseProfileSnapshot(
  value: Prisma.JsonValue,
): ProfileSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, Prisma.JsonValue>;
  if (
    typeof snapshot.subjectUserId !== "string" ||
    typeof snapshot.firstName !== "string" ||
    typeof snapshot.lastName !== "string" ||
    typeof snapshot.profileCreatedAt !== "string"
  ) {
    return null;
  }
  return value as unknown as ProfileSnapshot;
}

function parseCommunityContentSnapshot(
  value: Prisma.JsonValue,
): CommunityContentSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, Prisma.JsonValue>;
  if (
    !["Community", "Post", "Comment"].includes(
      String(snapshot.targetType ?? ""),
    ) ||
    typeof snapshot.targetId !== "string" ||
    typeof snapshot.communityId !== "string" ||
    typeof snapshot.communityName !== "string" ||
    typeof snapshot.authorId !== "string" ||
    typeof snapshot.authorName !== "string" ||
    typeof snapshot.body !== "string" ||
    typeof snapshot.status !== "string" ||
    typeof snapshot.createdAt !== "string" ||
    !Array.isArray(snapshot.mediaIds)
  ) {
    return null;
  }
  return value as unknown as CommunityContentSnapshot;
}

function parseMarketplaceListingSnapshot(
  value: Prisma.JsonValue,
): MarketplaceListingSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, Prisma.JsonValue>;
  if (
    typeof snapshot.listingId !== "string" ||
    typeof snapshot.sellerId !== "string" ||
    typeof snapshot.sellerName !== "string" ||
    typeof snapshot.title !== "string" ||
    typeof snapshot.description !== "string" ||
    typeof snapshot.priceFen !== "number" ||
    typeof snapshot.status !== "string" ||
    typeof snapshot.cityName !== "string" ||
    typeof snapshot.categoryName !== "string" ||
    typeof snapshot.createdAt !== "string" ||
    !Array.isArray(snapshot.mediaIds)
  ) {
    return null;
  }
  return value as unknown as MarketplaceListingSnapshot;
}

function serializeEvidence(
  actor: ModerationActor,
  evidence: {
    id: string;
    kind: string;
    label: string;
    snapshot: Prisma.JsonValue;
    sensitive: boolean;
    capturedAt: Date;
  },
) {
  const fullEvidence = hasAdminPermission(
    actor.role,
    "REPORT_VIEW_EVIDENCE_FULL",
  );
  const securityMetadata = hasAdminPermission(
    actor.role,
    "AUDIT_VIEW_SECURITY_METADATA",
  );
  if (evidence.kind === "PROFILE_SNAPSHOT") {
    const profile = parseProfileSnapshot(evidence.snapshot);
    if (!profile) {
      return {
        id: evidence.id,
        kind: evidence.kind,
        label: evidence.label,
        sensitive: evidence.sensitive,
        capturedAt: evidence.capturedAt,
        unavailable: true,
        profile: null,
        content: null,
        participants: [],
        messages: [],
      };
    }
    return {
      id: evidence.id,
      kind: evidence.kind,
      label: evidence.label,
      sensitive: evidence.sensitive,
      capturedAt: evidence.capturedAt,
      unavailable: false,
      content: null,
      profile: {
        subjectUserId: securityMetadata ? profile.subjectUserId : null,
        displayName: fullEvidence
          ? `${profile.firstName} ${profile.lastName}`
          : "Reported member",
        username: fullEvidence ? profile.username : null,
        bio: profile.bio,
        avatarMediaId: fullEvidence ? profile.avatarMediaId : null,
        profileAudience: profile.profileAudience,
        profileCreatedAt: profile.profileCreatedAt,
      },
      participants: [],
      messages: [],
    };
  }

  if (evidence.kind === "COMMUNITY_CONTENT_SNAPSHOT") {
    const content = parseCommunityContentSnapshot(evidence.snapshot);
    if (!content) {
      return {
        id: evidence.id,
        kind: evidence.kind,
        label: evidence.label,
        sensitive: evidence.sensitive,
        capturedAt: evidence.capturedAt,
        unavailable: true,
        profile: null,
        content: null,
        participants: [],
        messages: [],
      };
    }
    return {
      id: evidence.id,
      kind: evidence.kind,
      label: evidence.label,
      sensitive: evidence.sensitive,
      capturedAt: evidence.capturedAt,
      unavailable: false,
      profile: null,
      content: {
        targetType: content.targetType,
        targetId: securityMetadata ? content.targetId : null,
        communityId: securityMetadata ? content.communityId : null,
        communityName: content.communityName,
        postId: securityMetadata ? (content.postId ?? null) : null,
        authorId: securityMetadata ? content.authorId : null,
        authorName: fullEvidence ? content.authorName : "Reported member",
        authorUsername: fullEvidence ? content.authorUsername : null,
        title: content.title,
        body: content.body,
        status: content.status,
        postType: content.postType ?? null,
        mediaIds: fullEvidence ? content.mediaIds : [],
        createdAt: content.createdAt,
      },
      participants: [],
      messages: [],
    };
  }

  if (evidence.kind === "MARKETPLACE_LISTING_SNAPSHOT") {
    const listing = parseMarketplaceListingSnapshot(evidence.snapshot);
    if (!listing) {
      return {
        id: evidence.id,
        kind: evidence.kind,
        label: evidence.label,
        sensitive: evidence.sensitive,
        capturedAt: evidence.capturedAt,
        unavailable: true,
        profile: null,
        content: null,
        participants: [],
        messages: [],
      };
    }
    return {
      id: evidence.id,
      kind: evidence.kind,
      label: evidence.label,
      sensitive: evidence.sensitive,
      capturedAt: evidence.capturedAt,
      unavailable: false,
      profile: null,
      content: {
        targetType: "MarketplaceListing",
        targetId: securityMetadata ? listing.listingId : null,
        communityId: null,
        communityName: null,
        postId: null,
        authorId: securityMetadata ? listing.sellerId : null,
        authorName: fullEvidence ? listing.sellerName : "Reported member",
        authorUsername: fullEvidence ? listing.sellerUsername : null,
        title: listing.title,
        body: listing.description,
        status: listing.status,
        postType: null,
        mediaIds: fullEvidence ? listing.mediaIds : [],
        createdAt: listing.createdAt,
        priceFen: listing.priceFen,
        isNegotiable: listing.isNegotiable,
        cityName: listing.cityName,
        categoryName: listing.categoryName,
      },
      participants: [],
      messages: [],
    };
  }

  const snapshot = parseConversationSnapshot(evidence.snapshot);
  if (!snapshot) {
    return {
      id: evidence.id,
      kind: evidence.kind,
      label: evidence.label,
      sensitive: evidence.sensitive,
      capturedAt: evidence.capturedAt,
      unavailable: true,
      profile: null,
      content: null,
      participants: [],
      messages: [],
    };
  }

  const participantLabel = (participantId: string) => {
    const participant = snapshot.participants.find(
      (item) => item.id === participantId,
    );
    if (!participant) return "Unknown participant";
    if (!fullEvidence) {
      return participant.id === snapshot.reporterId
        ? "Reporting member"
        : "Reported member";
    }
    return `${participant.firstName} ${participant.lastName}`;
  };

  return {
    id: evidence.id,
    kind: evidence.kind,
    label: evidence.label,
    sensitive: evidence.sensitive,
    capturedAt: evidence.capturedAt,
    unavailable: false,
    profile: null,
    content: null,
    conversationId: securityMetadata ? snapshot.conversationId : null,
    participants: snapshot.participants.map((participant) => ({
      id: securityMetadata ? participant.id : null,
      name: participantLabel(participant.id),
      username: fullEvidence ? participant.username : null,
    })),
    messages: snapshot.messages.map((message) => ({
      id: securityMetadata ? message.id : null,
      sender: participantLabel(message.senderId),
      type: message.type,
      body: message.body,
      attachmentName: message.attachmentName,
      attachmentMime: fullEvidence ? message.attachmentMime : null,
      attachmentSize: fullEvidence ? message.attachmentSize : null,
      createdAt: message.createdAt,
    })),
  };
}

export async function getReportDetail(
  actor: ModerationActor,
  reportId: string,
) {
  if (!hasAdminPermission(actor.role, "REPORT_VIEW")) {
    throw new ModerationError("Access denied.", 403);
  }
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      assigneeId: true,
      targetType: true,
      targetId: true,
      reason: true,
      details: true,
      status: true,
      decision: true,
      resolution: true,
      assignedAt: true,
      resolvedAt: true,
      reopenedAt: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      reporter: { select: moderationUserSelect },
      subjectUser: { select: moderationUserSelect },
      assignee: { select: moderationUserSelect },
      assignedBy: { select: moderationUserSelect },
      resolvedBy: { select: moderationUserSelect },
      reopenedBy: { select: moderationUserSelect },
      notes: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: moderationUserSelect },
        },
        orderBy: { createdAt: "asc" },
      },
      evidence: {
        select: {
          id: true,
          kind: true,
          label: true,
          snapshot: true,
          sensitive: true,
          capturedAt: true,
        },
        orderBy: { capturedAt: "asc" },
      },
    },
  });
  if (!report) return null;
  if (!canAccessReport(actor, report)) {
    throw new ModerationError("Access denied.", 403);
  }

  const auditLogs = hasAdminPermission(actor.role, "AUDIT_VIEW_CASE")
    ? await prisma.auditLog.findMany({
        where: { entityType: "Report", entityId: report.id },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          oldValue: true,
          newValue: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          actor: { select: moderationUserSelect },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    decision: report.decision,
    resolution: report.resolution,
    assignedAt: report.assignedAt,
    resolvedAt: report.resolvedAt,
    reopenedAt: report.reopenedAt,
    version: report.version,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    reporter: safeUser(report.reporter),
    subjectUser: safeUser(report.subjectUser),
    assignee: safeUser(report.assignee),
    assignedBy: safeUser(report.assignedBy),
    resolvedBy: safeUser(report.resolvedBy),
    reopenedBy: safeUser(report.reopenedBy),
    notes: report.notes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt,
      author: safeUser(note.author),
    })),
    evidence: report.evidence.map((item) => serializeEvidence(actor, item)),
    auditLogs: auditLogs.map((log) => serializeAuditLog(actor, log)),
    permissions: {
      canClaim: hasAdminPermission(actor.role, "REPORT_CLAIM"),
      canAssignAny: hasAdminPermission(actor.role, "REPORT_ASSIGN_ANY"),
      canAddNote:
        hasAdminPermission(actor.role, "REPORT_ADD_NOTE") &&
        (hasAdminPermission(actor.role, "REPORT_ASSIGN_ANY") ||
          report.assignee?.id === actor.id),
      canTransition:
        hasAdminPermission(actor.role, "REPORT_TRANSITION_ASSIGNED") &&
        Boolean(report.assignee) &&
        (hasAdminPermission(actor.role, "REPORT_ASSIGN_ANY") ||
          report.assignee?.id === actor.id),
      canReopen: hasAdminPermission(actor.role, "REPORT_REOPEN"),
      evidenceLevel: hasAdminPermission(
        actor.role,
        "AUDIT_VIEW_SECURITY_METADATA",
      )
        ? "security"
        : hasAdminPermission(actor.role, "REPORT_VIEW_EVIDENCE_FULL")
          ? "full"
          : "redacted",
    },
  };
}

export async function listAssignableModerators(actor: ModerationActor) {
  if (!hasAdminPermission(actor.role, "REPORT_ASSIGN_ANY")) return [];
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["MODERATOR", "ADMIN", "SUPER_ADMIN"] },
    },
    select: moderationUserSelect,
    orderBy: [{ role: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
  });
  return users.map(safeUser);
}

export async function assignReport(input: {
  actor: ModerationActor;
  reportId: string;
  assigneeId: string | null;
  expectedVersion: number;
  metadata?: RequestMetadata;
}) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id: input.reportId },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        version: true,
      },
    });
    if (!report) throw new ModerationError("Report not found.", 404);
    if (!ACTIVE_REPORT_STATUSES.includes(report.status)) {
      throw new ModerationError("Closed reports cannot be assigned.", 409);
    }
    if (report.version !== input.expectedVersion) {
      throw new ModerationError(
        "This report was updated by another moderator.",
        409,
      );
    }

    const canAssignAny = hasAdminPermission(
      input.actor.role,
      "REPORT_ASSIGN_ANY",
    );
    if (!canAssignAny) {
      if (
        !hasAdminPermission(input.actor.role, "REPORT_CLAIM") ||
        input.assigneeId !== input.actor.id ||
        report.assigneeId !== null
      ) {
        throw new ModerationError("This report cannot be reassigned.", 403);
      }
    }

    if (input.assigneeId) {
      const assignee = await tx.user.findFirst({
        where: {
          id: input.assigneeId,
          status: "ACTIVE",
          role: { in: ["MODERATOR", "ADMIN", "SUPER_ADMIN"] },
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new ModerationError("Assignee not found or unavailable.", 404);
      }
    } else if (!canAssignAny) {
      throw new ModerationError(
        "Only administrators can unassign reports.",
        403,
      );
    }

    const now = new Date();
    const nextStatus: ReportStatus = input.assigneeId ? "REVIEWING" : "OPEN";
    const updated = await tx.report.updateMany({
      where: {
        id: report.id,
        version: input.expectedVersion,
        ...(canAssignAny ? {} : { assigneeId: null }),
      },
      data: {
        assigneeId: input.assigneeId,
        assignedById: input.assigneeId ? input.actor.id : null,
        assignedAt: input.assigneeId ? now : null,
        status: nextStatus,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ModerationError(
        "This report was claimed by another moderator.",
        409,
      );
    }

    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action:
        report.assigneeId && input.assigneeId
          ? "REPORT_REASSIGNED"
          : input.assigneeId
            ? "REPORT_ASSIGNED"
            : "REPORT_UNASSIGNED",
      entityType: "Report",
      entityId: report.id,
      oldValue: {
        assigneeId: report.assigneeId,
        status: report.status,
        version: report.version,
      },
      newValue: {
        assigneeId: input.assigneeId,
        status: nextStatus,
        version: report.version + 1,
      },
      ...input.metadata,
    });

    return {
      id: report.id,
      assigneeId: input.assigneeId,
      status: nextStatus,
      version: report.version + 1,
    };
  });
}

export async function transitionReport(input: {
  actor: ModerationActor;
  reportId: string;
  status: Exclude<ReportStatus, "OPEN">;
  expectedVersion: number;
  decision?: ReportDecision;
  resolution?: string;
  metadata?: RequestMetadata;
}) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id: input.reportId },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        decision: true,
        resolution: true,
        reporterId: true,
        version: true,
      },
    });
    if (!report) throw new ModerationError("Report not found.", 404);
    if (report.version !== input.expectedVersion) {
      throw new ModerationError(
        "This report was updated by another moderator.",
        409,
      );
    }

    validateReportTransition({
      actor: input.actor,
      report,
      targetStatus: input.status,
      decision: input.decision,
      resolution: input.resolution,
    });

    const now = new Date();
    const reopening =
      input.status === "REVIEWING" &&
      TERMINAL_REPORT_STATUSES.includes(report.status);
    const terminal = TERMINAL_REPORT_STATUSES.includes(input.status);
    const updated = await tx.report.updateMany({
      where: {
        id: report.id,
        version: input.expectedVersion,
        status: report.status,
      },
      data: reopening
        ? {
            status: "REVIEWING",
            assigneeId: input.actor.id,
            assignedById: input.actor.id,
            assignedAt: now,
            decision: null,
            resolution: null,
            resolvedAt: null,
            resolvedById: null,
            reopenedAt: now,
            reopenedById: input.actor.id,
            version: { increment: 1 },
          }
        : {
            status: input.status,
            decision: terminal ? input.decision : null,
            resolution: terminal ? input.resolution : null,
            resolvedAt: terminal ? now : null,
            resolvedById: terminal ? input.actor.id : null,
            version: { increment: 1 },
          },
    });
    if (updated.count !== 1) {
      throw new ModerationError(
        "This report was updated by another moderator.",
        409,
      );
    }

    const action = reopening
      ? "REPORT_REOPENED"
      : input.status === "RESOLVED"
        ? "REPORT_RESOLVED"
        : input.status === "DISMISSED"
          ? "REPORT_DISMISSED"
          : "REPORT_REVIEW_STARTED";
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action,
      entityType: "Report",
      entityId: report.id,
      oldValue: {
        status: report.status,
        decision: report.decision,
        resolution: report.resolution,
        assigneeId: report.assigneeId,
        version: report.version,
      },
      newValue: {
        status: input.status,
        decision: terminal ? input.decision : null,
        resolution: input.resolution ?? null,
        assigneeId: reopening ? input.actor.id : report.assigneeId,
        version: report.version + 1,
      },
      ...input.metadata,
    });
    if (terminal && report.reporterId) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: report.reporterId,
        actorId: input.actor.id,
        type: "MODERATION_UPDATE",
        templateKey: "MODERATION_RESULT",
        data: {
          outcome:
            input.status === "RESOLVED"
              ? "Kondo reviewed your report and confirmed that action was required."
              : "Kondo reviewed your report and closed it without confirming a violation.",
        },
        href: "/notifications",
        dedupeKey: `report-result:${report.id}:${report.version + 1}`,
      });
    }

    return {
      id: report.id,
      status: input.status,
      decision: terminal ? (input.decision ?? null) : null,
      resolution: terminal ? (input.resolution ?? null) : null,
      assigneeId: reopening ? input.actor.id : report.assigneeId,
      version: report.version + 1,
    };
  });
}

export async function addReportNote(input: {
  actor: ModerationActor;
  reportId: string;
  body: string;
  metadata?: RequestMetadata;
}) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id: input.reportId },
      select: { id: true, assigneeId: true },
    });
    if (!report) throw new ModerationError("Report not found.", 404);
    if (
      !hasAdminPermission(input.actor.role, "REPORT_ADD_NOTE") ||
      (!hasAdminPermission(input.actor.role, "REPORT_ASSIGN_ANY") &&
        report.assigneeId !== input.actor.id)
    ) {
      throw new ModerationError(
        "Claim the report before adding internal notes.",
        403,
      );
    }

    const note = await tx.reportNote.create({
      data: {
        reportId: report.id,
        authorId: input.actor.id,
        body: input.body,
      },
      select: { id: true, body: true, createdAt: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "REPORT_NOTE_ADDED",
      entityType: "Report",
      entityId: report.id,
      newValue: { noteId: note.id },
      ...input.metadata,
    });
    return note;
  });
}

export async function createOrReuseConversationReport(input: {
  reporterId: string;
  conversationId: string;
  reason: ReportReason;
  details?: string;
  metadata?: RequestMetadata;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const membership = await tx.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.reporterId,
          },
        },
        select: {
          conversation: {
            select: {
              id: true,
              participants: {
                select: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      username: true,
                    },
                  },
                },
              },
              messages: {
                select: {
                  id: true,
                  senderId: true,
                  type: true,
                  body: true,
                  attachmentName: true,
                  attachmentMime: true,
                  attachmentSize: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 50,
              },
            },
          },
        },
      });
      if (!membership) {
        throw new ModerationError("Conversation not found.", 404);
      }

      const existing = await tx.report.findFirst({
        where: {
          reporterId: input.reporterId,
          targetType: "Conversation",
          targetId: input.conversationId,
          status: { in: ACTIVE_REPORT_STATUSES },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };

      const participants = membership.conversation.participants.map(
        ({ user }) => user,
      );
      const subjectUserId =
        participants.find((user) => user.id !== input.reporterId)?.id ?? null;
      const report = await tx.report.create({
        data: {
          reporterId: input.reporterId,
          subjectUserId,
          targetType: "Conversation",
          targetId: input.conversationId,
          reason: input.reason,
          details: input.details,
        },
        select: { id: true },
      });

      const snapshot: ConversationSnapshot = {
        version: 1,
        conversationId: membership.conversation.id,
        reporterId: input.reporterId,
        subjectUserId,
        participants,
        messages: membership.conversation.messages.reverse().map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
      };
      await tx.reportEvidence.create({
        data: {
          reportId: report.id,
          kind: "CONVERSATION_SNAPSHOT",
          label: "Conversation at time of report",
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          capturedById: input.reporterId,
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: input.reporterId,
        action: "REPORT_CREATED",
        entityType: "Report",
        entityId: report.id,
        newValue: {
          targetType: "Conversation",
          targetId: input.conversationId,
          reason: input.reason,
          subjectUserId,
        },
        ...input.metadata,
      });
      return { reportId: report.id, reused: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.report.findFirst({
        where: {
          reporterId: input.reporterId,
          targetType: "Conversation",
          targetId: input.conversationId,
          status: { in: ACTIVE_REPORT_STATUSES },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
    }
    throw error;
  }
}

export async function listAuditLogs(
  actor: ModerationActor,
  filters: AuditListFilters = {},
) {
  if (!hasAdminPermission(actor.role, "AUDIT_VIEW_GLOBAL")) {
    throw new ModerationError("Access denied.", 403);
  }
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const where: Prisma.AuditLogWhereInput = {
    AND: [
      filters.action
        ? { action: { contains: filters.action, mode: "insensitive" } }
        : {},
      filters.entityType
        ? {
            entityType: {
              contains: filters.entityType,
              mode: "insensitive",
            },
          }
        : {},
      filters.actorId ? { actorId: filters.actorId } : {},
      filters.query
        ? {
            OR: [
              {
                action: {
                  contains: filters.query,
                  mode: "insensitive",
                },
              },
              {
                entityType: {
                  contains: filters.query,
                  mode: "insensitive",
                },
              },
              {
                entityId: {
                  contains: filters.query,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
    ],
  };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        oldValue: true,
        newValue: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        actor: { select: moderationUserSelect },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    logs: logs.map((log) => serializeAuditLog(actor, log)),
  };
}
