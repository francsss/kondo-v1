import { createHash } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

type UploadTokenInput = {
  assetId: string;
  ownerId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
};

function mediaSecret() {
  const secret =
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === "production"
      ? null
      : "dev-only-kondo-secret-change-me-before-launch");
  if (!secret) throw new Error("JWT_SECRET is required for media signing.");
  return new Uint8Array(
    createHash("sha256").update(`kondo-media:${secret}`).digest(),
  );
}

export async function createMediaUploadToken(
  input: UploadTokenInput,
  expiresInSeconds = 10 * 60,
) {
  return new SignJWT({
    ...input,
    tokenUse: "media-upload",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(mediaSecret());
}

export async function verifyMediaUploadToken(
  token: string,
): Promise<UploadTokenInput | null> {
  try {
    const { payload } = await jwtVerify(token, mediaSecret());
    if (
      payload.tokenUse !== "media-upload" ||
      typeof payload.assetId !== "string" ||
      typeof payload.ownerId !== "string" ||
      typeof payload.objectKey !== "string" ||
      typeof payload.mimeType !== "string" ||
      typeof payload.sizeBytes !== "number"
    ) {
      return null;
    }
    return {
      assetId: payload.assetId,
      ownerId: payload.ownerId,
      objectKey: payload.objectKey,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
    };
  } catch {
    return null;
  }
}
