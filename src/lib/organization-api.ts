import { EmailDeliveryError } from "@/lib/email";
import { OrganizationAccessError } from "@/lib/organization-permissions";
import { OrganizationError } from "@/lib/organizations";
import { internalApiError, jsonError } from "@/lib/request";

export function organizationApiFailure(event: string, error: unknown) {
  if (
    error instanceof OrganizationError ||
    error instanceof OrganizationAccessError
  ) {
    return jsonError(error.message, error.status);
  }
  if (error instanceof EmailDeliveryError) {
    return jsonError(
      "The invitation could not be delivered. Check the email configuration and try again.",
      503,
    );
  }
  return internalApiError(event, error);
}
