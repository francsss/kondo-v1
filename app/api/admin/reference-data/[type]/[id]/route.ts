import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  deleteReferenceData,
  parseReferenceType,
  ReferenceDataError,
  updateReferenceData,
} from "@/lib/reference-data";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import {
  referenceCityUpdateSchema,
  referenceCountryUpdateSchema,
  referenceUniversityUpdateSchema,
} from "@/lib/validation";

function schemaFor(type: "countries" | "cities" | "universities") {
  if (type === "countries") return referenceCountryUpdateSchema;
  if (type === "cities") return referenceCityUpdateSchema;
  return referenceUniversityUpdateSchema;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("REFERENCE_DATA_MANAGE");
  if (!auth.authorized) return auth.error;
  const { type: rawType, id } = await params;
  const type = parseReferenceType(rawType);
  if (!type) {
    return adminJson({ error: "Reference type not found." }, { status: 404 });
  }
  const parsed = schemaFor(type).safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return adminJson(
      {
        error:
          parsed.success
            ? "Provide at least one field to update."
            : (parsed.error.issues[0]?.message ??
              "Invalid reference-data update."),
      },
      { status: 400 },
    );
  }

  try {
    const record = await updateReferenceData(
      auth.user,
      type,
      id,
      parsed.data,
      getRequestMeta(request),
    );
    return adminJson({ record });
  } catch (error) {
    if (error instanceof ReferenceDataError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reference.update", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("REFERENCE_DATA_MANAGE");
  if (!auth.authorized) return auth.error;
  const { type: rawType, id } = await params;
  const type = parseReferenceType(rawType);
  if (!type) {
    return adminJson({ error: "Reference type not found." }, { status: 404 });
  }

  try {
    return adminJson({
      result: await deleteReferenceData(
        auth.user,
        type,
        id,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    if (error instanceof ReferenceDataError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.reference.delete", error);
  }
}
