
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

import { MIME_EXTENSIONS, type MediaKind } from "@/lib/product-media";

const REGION = process.env.AWS_REGION || "eu-north-1";
const BUCKET = process.env.AWS_S3_BUCKET;

if (!BUCKET) {
  throw new Error("AWS_S3_BUCKET environment variable is missing");
}

const s3 = new S3Client({
  region: REGION,
});

const UPLOAD_EXPIRES_SECONDS = 600;
const DOWNLOAD_EXPIRES_SECONDS = 3600;

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  type: MediaKind;
  contentType: string;
}

export interface PresignedDownload {
  url: string;
  expiresIn: number;
}

/**
 * Validate S3 object keys before accessing them.
 * Only allow files inside products/.
 */
export function isValidMediaKey(key: string): boolean {
  return /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif|mp4|webm|mov)$/i.test(
    key,
  );
}

/**
 * Generate a presigned URL for uploading a product image/video.
 */
export async function createPresignedUpload(
  contentType: string,
): Promise<PresignedUpload> {
  const info = MIME_EXTENSIONS[contentType];

  if (!info) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const key = `products/${randomUUID()}.${info.ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_EXPIRES_SECONDS,
  });

  return {
    uploadUrl,
    key,
    type: info.type,
    contentType,
  };
}

/**
 * Generate a temporary URL for viewing private product media.
 */
export async function createPresignedDownload(
  key: string,
): Promise<PresignedDownload> {
  if (!isValidMediaKey(key)) {
    throw new Error("Invalid product media key");
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(s3, command, {
    expiresIn: DOWNLOAD_EXPIRES_SECONDS,
  });

  return {
    url,
    expiresIn: DOWNLOAD_EXPIRES_SECONDS,
  };
}

/**
 * Check whether an uploaded media object exists.
 */
export async function headMedia(key: string) {
  if (!isValidMediaKey(key)) {
    return null;
  }

  try {
    const response = await s3.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
    );

    return {
      size: response.ContentLength ?? 0,
      contentType: response.ContentType ?? "",
    };
  } catch (error) {
    console.error("S3 HeadObject failed:", error);
    return null;
  }
}

/**
 * Delete one product media object.
 */
export async function deleteFromS3(key: string) {
  if (!isValidMediaKey(key)) {
    throw new Error("Invalid product media key");
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
}

/**
 * Delete multiple product media objects.
 */
export async function deleteManyFromS3(keys: string[]) {
  if (keys.length === 0) return;

  await Promise.allSettled(
    keys.map((key) => deleteFromS3(key)),
  );
}
