import type { MediaKind, MediaPurpose, MediaVisibility } from "@prisma/client";
import { extname } from "node:path";

type MediaPolicy = {
  kind: MediaKind | "MIXED";
  visibility: MediaVisibility;
  maxBytes: number;
  mimeExtensions: Record<string, readonly string[]>;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  altRequired: boolean;
};

const imageTypes = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;

export const MEDIA_POLICIES: Record<MediaPurpose, MediaPolicy> = {
  PROFILE_AVATAR: {
    kind: "IMAGE",
    visibility: "PRIVATE",
    maxBytes: 5 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 128,
    minHeight: 128,
    maxWidth: 4096,
    maxHeight: 4096,
    altRequired: true,
  },
  ORGANIZATION_LOGO: {
    kind: "IMAGE",
    visibility: "PRIVATE",
    maxBytes: 5 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 128,
    minHeight: 128,
    maxWidth: 4096,
    maxHeight: 4096,
    altRequired: true,
  },
  ORGANIZATION_COVER: {
    kind: "IMAGE",
    visibility: "PRIVATE",
    maxBytes: 8 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 640,
    minHeight: 240,
    maxWidth: 8192,
    maxHeight: 8192,
    altRequired: true,
  },
  ORGANIZATION_VERIFICATION_DOCUMENT: {
    kind: "MIXED",
    visibility: "PRIVATE",
    maxBytes: 10 * 1024 * 1024,
    mimeExtensions: {
      ...imageTypes,
      "application/pdf": ["pdf"],
    },
    maxWidth: 8192,
    maxHeight: 8192,
    altRequired: false,
  },
  COMMUNITY_COVER: {
    kind: "IMAGE",
    visibility: "PUBLIC",
    maxBytes: 8 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 640,
    minHeight: 240,
    maxWidth: 8192,
    maxHeight: 8192,
    altRequired: true,
  },
  POST_IMAGE: {
    kind: "IMAGE",
    visibility: "PUBLIC",
    maxBytes: 8 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 160,
    minHeight: 160,
    maxWidth: 8192,
    maxHeight: 8192,
    altRequired: true,
  },
  LISTING_IMAGE: {
    kind: "IMAGE",
    visibility: "PUBLIC",
    maxBytes: 8 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 320,
    minHeight: 320,
    maxWidth: 8192,
    maxHeight: 8192,
    altRequired: true,
  },
  GUIDE_COVER: {
    kind: "IMAGE",
    visibility: "PUBLIC",
    maxBytes: 8 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 640,
    minHeight: 320,
    maxWidth: 8192,
    maxHeight: 8192,
    altRequired: true,
  },
  MESSAGE_IMAGE: {
    kind: "IMAGE",
    visibility: "PRIVATE",
    maxBytes: 8 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 64,
    minHeight: 64,
    maxWidth: 8192,
    maxHeight: 8192,
    altRequired: true,
  },
  MESSAGE_DOCUMENT: {
    kind: "DOCUMENT",
    visibility: "PRIVATE",
    maxBytes: 10 * 1024 * 1024,
    mimeExtensions: {
      "application/pdf": ["pdf"],
    },
    altRequired: false,
  },
  SCHEDULE_IMPORT: {
    kind: "MIXED",
    visibility: "PRIVATE",
    maxBytes: 15 * 1024 * 1024,
    mimeExtensions: {
      ...imageTypes,
      "application/pdf": ["pdf"],
    },
    maxWidth: 12_000,
    maxHeight: 12_000,
    altRequired: false,
  },
  STORY_VIDEO: {
    kind: "VIDEO",
    visibility: "PUBLIC",
    maxBytes: 25 * 1024 * 1024,
    mimeExtensions: {
      "video/mp4": ["mp4"],
      "video/quicktime": ["mov", "qt"],
      "video/x-m4v": ["m4v"],
      "video/hevc": ["hevc", "h265", "mov", "mp4"],
      "video/h265": ["hevc", "h265", "mov", "mp4"],
    },
    altRequired: false,
  },
  STORY_POSTER: {
    kind: "IMAGE",
    visibility: "PUBLIC",
    maxBytes: 8 * 1024 * 1024,
    mimeExtensions: imageTypes,
    minWidth: 360,
    minHeight: 640,
    maxWidth: 8192,
    maxHeight: 8192,
    altRequired: true,
  },
  VERIFICATION_DOCUMENT: {
    kind: "DOCUMENT",
    visibility: "PRIVATE",
    maxBytes: 10 * 1024 * 1024,
    mimeExtensions: {
      "application/pdf": ["pdf"],
    },
    altRequired: false,
  },
};

export class MediaPolicyError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "MediaPolicyError";
  }
}

export function normalizedExtension(fileName: string) {
  return extname(fileName).slice(1).trim().toLowerCase();
}

export function validateMediaIntent(input: {
  purpose: MediaPurpose;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  altText?: string | null;
}) {
  const policy = MEDIA_POLICIES[input.purpose];
  const extension = normalizedExtension(input.fileName);
  const mimeType = input.mimeType.trim().toLowerCase();
  const allowedExtensions = policy.mimeExtensions[mimeType];

  if (!extension || !allowedExtensions?.includes(extension)) {
    throw new MediaPolicyError(
      "The file extension does not match an allowed media type.",
    );
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new MediaPolicyError("File size must be a positive integer.");
  }
  if (input.sizeBytes > policy.maxBytes) {
    throw new MediaPolicyError("The file is larger than the allowed limit.");
  }
  const altText = input.altText?.trim() || null;
  if (policy.altRequired && (!altText || altText.length < 2)) {
    throw new MediaPolicyError(
      "Describe this image with at least 2 characters of alt text.",
    );
  }
  if (altText && altText.length > 240) {
    throw new MediaPolicyError("Alt text must not exceed 240 characters.");
  }

  return {
    policy,
    kind:
      policy.kind === "MIXED"
        ? mimeType === "application/pdf"
          ? ("DOCUMENT" as const)
          : ("IMAGE" as const)
        : policy.kind,
    extension,
    mimeType,
    altText,
  };
}
