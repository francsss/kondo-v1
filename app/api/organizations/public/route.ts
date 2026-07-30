import type {
  OrganizationCapabilityKey,
  OrganizationType,
} from "@prisma/client";
import { NextRequest } from "next/server";
import {
  ORGANIZATION_CAPABILITY_KEYS,
} from "@/lib/organization-capabilities";
import { listPublicOrganizations } from "@/lib/organization-public-profile";
import {
  ORGANIZATION_TYPE_KEYS,
} from "@/features/organizations/registry";
import { internalApiError } from "@/lib/request";

function organizationType(value: string | null) {
  return ORGANIZATION_TYPE_KEYS.includes(value as OrganizationType)
    ? (value as OrganizationType)
    : undefined;
}

function capability(value: string | null) {
  return ORGANIZATION_CAPABILITY_KEYS.includes(
    value as OrganizationCapabilityKey,
  )
    ? (value as OrganizationCapabilityKey)
    : undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const directory = await listPublicOrganizations({
      query: params.get("q") ?? undefined,
      type: organizationType(params.get("type")),
      capability: capability(params.get("capability")),
      cityId: params.get("city") ?? undefined,
      countryId: params.get("country") ?? undefined,
      verification:
        params.get("verification") === "VERIFIED" ? "VERIFIED" : undefined,
      partner: params.get("partner") === "true",
      page: Number(params.get("page") || 1),
    });
    return Response.json(directory, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return internalApiError("organizations.public.directory", error);
  }
}
