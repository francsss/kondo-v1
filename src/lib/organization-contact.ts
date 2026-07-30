import type {
  OrganizationContactType,
  OrganizationContactVisibility,
} from "@prisma/client";
import { isHttpWebsiteUrl, normalizeWebsiteUrl } from "@/lib/website-url";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{6,40}$/;
const HANDLE_PATTERN = /^[\p{L}\p{N}_.+\-\s]{2,120}$/u;

export class OrganizationContactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationContactError";
  }
}

export type OrganizationContactInput = {
  id?: string;
  type: OrganizationContactType;
  label?: string;
  value: string;
  visibility: OrganizationContactVisibility;
};

function clean(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || CONTROL_CHARACTERS.test(normalized)) {
    throw new OrganizationContactError("Enter a valid public contact value.");
  }
  return normalized;
}

export function normalizeOrganizationContact(
  input: OrganizationContactInput,
): OrganizationContactInput {
  const value = clean(input.value);
  let normalized = value;
  if (input.type === "WEBSITE") {
    normalized = normalizeWebsiteUrl(value);
    if (!isHttpWebsiteUrl(normalized)) {
      throw new OrganizationContactError(
        "Enter a secure HTTP or HTTPS website.",
      );
    }
  } else if (input.type === "EMAIL") {
    normalized = value.toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      throw new OrganizationContactError("Enter a valid professional email.");
    }
  } else if (input.type === "PHONE") {
    if (!PHONE_PATTERN.test(value)) {
      throw new OrganizationContactError("Enter a valid professional phone.");
    }
  } else if (input.type === "WHATSAPP") {
    const digits = value.replace(/[^\d+]/g, "");
    if (!/^\+?\d{7,20}$/.test(digits)) {
      throw new OrganizationContactError("Enter a valid WhatsApp number.");
    }
    normalized = digits;
  } else if (
    (input.type === "WECHAT" || input.type === "OTHER") &&
    !HANDLE_PATTERN.test(value)
  ) {
    throw new OrganizationContactError(
      "This professional contact identifier is not supported.",
    );
  }
  return {
    ...input,
    label: input.label?.normalize("NFKC").trim() || undefined,
    value: normalized,
  };
}

export function serializePublicOrganizationContact(input: {
  id: string;
  type: OrganizationContactType;
  label: string | null;
  value: string;
  visibility: OrganizationContactVisibility;
}) {
  if (input.visibility !== "PUBLIC") return null;
  const normalized = normalizeOrganizationContact({
    ...input,
    label: input.label ?? undefined,
  });
  const defaultLabel: Record<OrganizationContactType, string> = {
    WEBSITE: "Official website",
    EMAIL: "Professional email",
    PHONE: "Professional phone",
    WECHAT: "WeChat",
    WHATSAPP: "WhatsApp",
    OTHER: "Professional contact",
  };
  const href =
    normalized.type === "WEBSITE"
      ? normalized.value
      : normalized.type === "EMAIL"
        ? `mailto:${normalized.value}`
        : normalized.type === "PHONE"
          ? `tel:${normalized.value.replace(/[^\d+]/g, "")}`
          : normalized.type === "WHATSAPP"
            ? `https://wa.me/${normalized.value.replace(/[^\d]/g, "")}`
            : null;
  return {
    id: input.id,
    type: normalized.type,
    label: normalized.label || defaultLabel[normalized.type],
    value: normalized.value,
    href,
    external: normalized.type === "WEBSITE" || normalized.type === "WHATSAPP",
  };
}
