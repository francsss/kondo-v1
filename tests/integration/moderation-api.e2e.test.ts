import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const mocks = vi.hoisted(() => ({
  currentUser: null as null | { id: string; role: string },
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: () => Promise.resolve(mocks.currentUser),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ allowed: true }),
}));

import { GET as getReport } from "../../app/api/admin/reports/[id]/route";
import { POST as assignReport } from "../../app/api/admin/reports/[id]/assignment/route";
import { POST as addNote } from "../../app/api/admin/reports/[id]/notes/route";
import { POST as transitionReport } from "../../app/api/admin/reports/[id]/transition/route";
import { POST as reportConversation } from "../../app/api/conversations/[id]/report/route";

const createdUserIds: string[] = [];
const createdConversationIds: string[] = [];
const createdReportIds: string[] = [];

function request(path: string, body: object) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "user-agent": "Kondo Module 3 API E2E",
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  mocks.currentUser = null;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: createdUserIds } },
        { entityId: { in: [...createdReportIds, ...createdUserIds] } },
      ],
    },
  });
  await prisma.report.deleteMany({
    where: { id: { in: createdReportIds } },
  });
  await prisma.conversation.deleteMany({
    where: { id: { in: createdConversationIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("report-to-resolution API E2E on PostgreSQL", () => {
  it("completes the member report, assignment, note, resolution, and safe detail flow", async () => {
    const token = randomUUID().replaceAll("-", "");
    const [reporter, subject, moderator, admin] = await Promise.all(
      [
        ["Reporter", "MEMBER"],
        ["Subject", "MEMBER"],
        ["Moderator", "MODERATOR"],
        ["Admin", "ADMIN"],
      ].map(([label, role]) =>
        prisma.user.create({
          data: {
            email: `module3-e2e-${label.toLowerCase()}-${token}@example.test`,
            firstName: label,
            lastName: "E2E",
            username: `m3e2e-${label.toLowerCase()}-${token.slice(0, 10)}`,
            role: role as "MEMBER" | "MODERATOR" | "ADMIN",
            status: "ACTIVE",
          },
        }),
      ),
    );
    createdUserIds.push(reporter.id, subject.id, moderator.id, admin.id);

    const conversation = await prisma.conversation.create({
      data: {
        directKey: [reporter.id, subject.id].sort().join(":"),
        participants: {
          create: [{ userId: reporter.id }, { userId: subject.id }],
        },
        messages: {
          create: {
            senderId: subject.id,
            body: "This message is captured as immutable report evidence.",
          },
        },
      },
    });
    createdConversationIds.push(conversation.id);

    mocks.currentUser = { id: reporter.id, role: reporter.role };
    const reportResponse = await reportConversation(
      request(`/api/conversations/${conversation.id}/report`, {
        reason: "HARASSMENT",
        details: "The conversation needs an operational moderation review.",
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(reportResponse.status).toBe(201);
    const reportPayload = await reportResponse.json();
    createdReportIds.push(reportPayload.reportId);

    mocks.currentUser = { id: admin.id, role: admin.role };
    const assignmentResponse = await assignReport(
      request(`/api/admin/reports/${reportPayload.reportId}/assignment`, {
        assigneeId: moderator.id,
        expectedVersion: 1,
      }),
      { params: Promise.resolve({ id: reportPayload.reportId }) },
    );
    expect(assignmentResponse.status).toBe(200);
    const assignmentPayload = await assignmentResponse.json();

    mocks.currentUser = { id: moderator.id, role: moderator.role };
    const noteResponse = await addNote(
      request(`/api/admin/reports/${reportPayload.reportId}/notes`, {
        body: "The evidence was reviewed under the redacted moderator view.",
      }),
      { params: Promise.resolve({ id: reportPayload.reportId }) },
    );
    expect(noteResponse.status).toBe(201);

    const resolutionResponse = await transitionReport(
      request(`/api/admin/reports/${reportPayload.reportId}/transition`, {
        status: "RESOLVED",
        expectedVersion: assignmentPayload.report.version,
        decision: "VIOLATION_CONFIRMED",
        resolution: "The preserved evidence confirms the reported violation.",
      }),
      { params: Promise.resolve({ id: reportPayload.reportId }) },
    );
    expect(resolutionResponse.status).toBe(200);

    mocks.currentUser = { id: admin.id, role: admin.role };
    const detailResponse = await getReport(new Request("http://localhost"), {
      params: Promise.resolve({ id: reportPayload.reportId }),
    });
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(detailResponse.headers.get("vary")).toBe("Cookie");
    const detailPayload = await detailResponse.json();
    expect(detailPayload.report.status).toBe("RESOLVED");
    expect(detailPayload.report.notes).toHaveLength(1);
    expect(detailPayload.report.evidence).toHaveLength(1);
    expect(
      detailPayload.report.auditLogs.map(
        (log: { action: string }) => log.action,
      ),
    ).toEqual([
      "REPORT_CREATED",
      "REPORT_ASSIGNED",
      "REPORT_NOTE_ADDED",
      "REPORT_RESOLVED",
    ]);
    expect(JSON.stringify(detailPayload)).not.toContain("attachmentKey");
  });
});
