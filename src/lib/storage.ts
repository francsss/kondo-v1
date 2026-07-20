import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { MediaStorageProvider } from "@prisma/client";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export type UploadTarget = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

export type ReadTarget = {
  url: string;
  expiresAt: string;
};

export interface ObjectStorage {
  readonly provider: MediaStorageProvider;
  createUploadTarget(input: {
    assetId: string;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    uploadToken: string;
    expiresAt: Date;
  }): Promise<UploadTarget>;
  createReadTarget(input: {
    objectKey: string;
    contentType: string;
    contentDisposition: string;
    expiresAt: Date;
  }): Promise<ReadTarget | null>;
  read(objectKey: string): Promise<Uint8Array>;
  write(
    objectKey: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void>;
  head(
    objectKey: string,
  ): Promise<{ sizeBytes: number; contentType: string | null }>;
  delete(objectKey: string): Promise<void>;
}

function configuredDriver() {
  const driver =
    process.env.STORAGE_DRIVER ??
    (process.env.NODE_ENV === "production" ? "s3" : "local");
  if (driver !== "local" && driver !== "s3") {
    throw new Error("STORAGE_DRIVER must be local or s3.");
  }
  if (process.env.NODE_ENV === "production" && driver === "local") {
    throw new Error("Local media storage is not allowed in production.");
  }
  return driver;
}

function localRoot() {
  return resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.STORAGE_LOCAL_ROOT ?? ".data/media",
  );
}

function localPath(objectKey: string) {
  const root = localRoot();
  const path = resolve(/*turbopackIgnore: true*/ root, objectKey);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error("Invalid media object key.");
  }
  return path;
}

class LocalObjectStorage implements ObjectStorage {
  readonly provider = "LOCAL" as const;

  async createUploadTarget(input: {
    assetId: string;
    contentType: string;
    uploadToken: string;
    expiresAt: Date;
  }): Promise<UploadTarget> {
    return {
      url: `/api/media/uploads/${input.assetId}/content`,
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        "X-Kondo-Upload-Token": input.uploadToken,
      },
      expiresAt: input.expiresAt.toISOString(),
    };
  }

  async createReadTarget(): Promise<null> {
    return null;
  }

  async read(objectKey: string) {
    return new Uint8Array(await readFile(localPath(objectKey)));
  }

  async write(objectKey: string, bytes: Uint8Array) {
    const path = localPath(objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: "wx" });
  }

  async head(objectKey: string) {
    const metadata = await stat(localPath(objectKey));
    return { sizeBytes: metadata.size, contentType: null };
  }

  async delete(objectKey: string) {
    await rm(localPath(objectKey), { force: true });
  }
}

let s3Client: S3Client | null = null;

function getS3Client() {
  if (s3Client) return s3Client;
  const region = process.env.STORAGE_REGION;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 media storage credentials are incomplete.");
  }
  s3Client = new S3Client({
    region,
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.STORAGE_ENDPOINT),
    credentials: { accessKeyId, secretAccessKey },
    // Flexible checksums are enabled by default in recent AWS SDK releases.
    // A presigned browser PUT has no body when it is signed, so that default
    // produces a CRC32 for an empty object. R2 then rejects the real file.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return s3Client;
}

function storageBucket() {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET is required.");
  return bucket;
}

class S3ObjectStorage implements ObjectStorage {
  readonly provider = "S3" as const;

  async createUploadTarget(input: {
    objectKey: string;
    contentType: string;
    expiresAt: Date;
  }): Promise<UploadTarget> {
    const expiresIn = Math.max(
      1,
      Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
    );
    const url = await getSignedUrl(
      getS3Client(),
      new PutObjectCommand({
        Bucket: storageBucket(),
        Key: input.objectKey,
        ContentType: input.contentType,
        CacheControl: "private, no-store",
      }),
      { expiresIn },
    );
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      expiresAt: input.expiresAt.toISOString(),
    };
  }

  async createReadTarget(input: {
    objectKey: string;
    contentType: string;
    contentDisposition: string;
    expiresAt: Date;
  }): Promise<ReadTarget> {
    const expiresIn = Math.max(
      1,
      Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
    );
    const url = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({
        Bucket: storageBucket(),
        Key: input.objectKey,
        ResponseCacheControl: "private, no-store",
        ResponseContentDisposition: input.contentDisposition,
        ResponseContentType: input.contentType,
      }),
      { expiresIn },
    );
    return { url, expiresAt: input.expiresAt.toISOString() };
  }

  async read(objectKey: string) {
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: storageBucket(), Key: objectKey }),
    );
    if (!response.Body) throw new Error("Media object body is unavailable.");
    return new Uint8Array(await response.Body.transformToByteArray());
  }

  async write(objectKey: string, bytes: Uint8Array, contentType: string) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: storageBucket(),
        Key: objectKey,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "private, no-store",
      }),
    );
  }

  async head(objectKey: string) {
    const response = await getS3Client().send(
      new HeadObjectCommand({ Bucket: storageBucket(), Key: objectKey }),
    );
    return {
      sizeBytes: response.ContentLength ?? 0,
      contentType: response.ContentType ?? null,
    };
  }

  async delete(objectKey: string) {
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: storageBucket(), Key: objectKey }),
    );
  }
}

const localStorage = new LocalObjectStorage();
const s3Storage = new S3ObjectStorage();

export function getObjectStorage(): ObjectStorage {
  return configuredDriver() === "s3" ? s3Storage : localStorage;
}

export function getObjectStorageForProvider(
  provider: MediaStorageProvider,
): ObjectStorage {
  return provider === "S3" ? s3Storage : localStorage;
}

export function isStorageObjectNotFound(error: unknown) {
  if (!(error instanceof Error)) return false;
  const coded = error as Error & {
    code?: string;
    name: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    coded.code === "ENOENT" ||
    coded.name === "NoSuchKey" ||
    coded.name === "NotFound" ||
    coded.$metadata?.httpStatusCode === 404
  );
}
