import { NextRequest } from "next/server";
import { removeOwnedMedia } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const id = (await params).id;
  try {
    const scheduleImport = await prisma.scheduleImport.findFirst({
      where: {
        id,
        ownerId: user.id,
        status: { in: ["UPLOADED", "FAILED", "REVIEW_REQUIRED"] },
      },
      include: { files: true },
    });
    if (!scheduleImport) return jsonError("Import not found.", 404);
    await prisma.scheduleImport.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    for (const file of scheduleImport.files) {
      await removeOwnedMedia(
        user,
        file.mediaAssetId,
        getRequestMeta(request),
      ).catch(() => null);
      await prisma.scheduleImportFile.update({
        where: { id: file.id },
        data: { deletedAt: new Date() },
      });
    }
    return Response.json({ cancelled: true });
  } catch (error) {
    return internalApiError("student-hub.import.cancel", error);
  }
}
