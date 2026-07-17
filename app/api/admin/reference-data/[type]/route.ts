import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  createReferenceData,
  listReferenceData,
  parseReferenceType,
  ReferenceDataError,
} from "@/lib/reference-data";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import {
  referenceCitySchema,
  referenceCountrySchema,
  referenceUniversitySchema,
} from "@/lib/validation";

function schemaFor(type: "countries" | "cities" | "universities") {
  if (type === "countries") return referenceCountrySchema;
  if (type === "cities") return referenceCitySchema;
  return referenceUniversitySchema;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const auth = await authorizeAdminApi("REFERENCE_DATA_VIEW");
  if (!auth.authorized) return auth.error;
  const type = parseReferenceType((await params).type);
  if (!type) {
    return adminJson({ error: "Reference type not found." }, { status: 404 });
  }

  try {
    const query = request.nextUrl.searchParams;
    return adminJson(
      await listReferenceData(auth.user, type, {
        page: Number(query.get("page") ?? 1),
        pageSize: Number(query.get("pageSize") ?? 25),
        query: query.get("q")?.trim() || undefined,
      }),
    );
  } catch (error) {
    if (error instanceof ReferenceDataError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reference.list", error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("REFERENCE_DATA_MANAGE");
  if (!auth.authorized) return auth.error;
  const type = parseReferenceType((await params).type);
  if (!type) {
    return adminJson({ error: "Reference type not found." }, { status: 404 });
  }
  const parsed = schemaFor(type).safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid reference-data record.",
      },
      { status: 400 },
    );
  }

  try {
    const record = await createReferenceData(
      auth.user,
      type,
      parsed.data,
      getRequestMeta(request),
    );
    return adminJson({ record }, { status: 201 });
  } catch (error) {
    if (error instanceof ReferenceDataError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reference.create", error);
  }
}
