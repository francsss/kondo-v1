import { ZodError } from "zod";
import { MessagingError } from "@/lib/messaging";
import { OrganizationCatalogError } from "@/lib/organization-catalog";
import { OrganizationAccessError } from "@/lib/organization-permissions";
import { internalApiError, jsonError } from "@/lib/request";

export function organizationCatalogApiFailure(event: string, error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(
      error.issues[0]?.message ?? "Check the highlighted catalog field.",
      400,
    );
  }
  if (
    error instanceof OrganizationCatalogError ||
    error instanceof OrganizationAccessError ||
    error instanceof MessagingError
  ) {
    return jsonError(error.message, error.status);
  }
  return internalApiError(event, error);
}
