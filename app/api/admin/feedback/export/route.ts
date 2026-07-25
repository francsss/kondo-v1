import type { PetFeedbackCategory, PetFeedbackStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { exportPetFeedbackCsv } from "@/lib/pet-feedback";
import {
  petFeedbackCategories,
  petFeedbackPageAreas,
  petFeedbackStatuses,
} from "@/lib/pet-feedback-validation";

export async function GET(request: NextRequest) {
  const auth = await authorizeAdminApi("FEEDBACK_VIEW");
  if (!auth.authorized) return auth.error;
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "";
  const pageArea = request.nextUrl.searchParams.get("area") ?? "";
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  try {
    const csv = await exportPetFeedbackCsv(auth.user, {
      status: petFeedbackStatuses.includes(
        status as (typeof petFeedbackStatuses)[number],
      )
        ? (status as PetFeedbackStatus)
        : undefined,
      category: petFeedbackCategories.includes(
        category as (typeof petFeedbackCategories)[number],
      )
        ? (category as PetFeedbackCategory)
        : undefined,
      pageArea: petFeedbackPageAreas.includes(
        pageArea as (typeof petFeedbackPageAreas)[number],
      )
        ? pageArea
        : undefined,
      query: query || undefined,
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="kondo-feedback-${date}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Access denied.") {
      return adminJson({ error: error.message }, { status: 403 });
    }
    return adminInternalError("admin.pet-feedback.export", error);
  }
}
