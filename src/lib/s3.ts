import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

import { MIME_EXTENSIONS, type MediaKind } from "@/lib/product-media";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const BUCKET = process.env.AWS_S3_BUCKET!;
const PUBLIC_BASE_URL = (process.env.S3_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
const PRESIGN_EXPIRES_SECONDS = 600;

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  url: string;
  type: MediaKind;
  contentType: string;
}

export const getPublicUrl = (key: string) => `${PUBLIC_BASE_URL}/${key}`;

export async function createPresignedUpload(
  contentType: string,
): Promise<PresignedUpload> {
  const info = MIME_EXTENSIONS[contentType];
  if (!info) throw new Error(`Unsupported content type: ${contentType}`);

  const key = `products/${randomUUID()}.${info.ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: PRESIGN_EXPIRES_SECONDS },
  );

  return {
    uploadUrl,
    key,
    url: getPublicUrl(key),
    type: info.type,
    contentType,
  };
}

export async function headMedia(key: string) {
  try {
    const res = await s3.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "" };
  } catch {
    return null;
  }
}

export async function deleteFromS3(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function deleteManyFromS3(keys: string[]) {
  if (keys.length === 0) return;
  await Promise.allSettled(keys.map((key) => deleteFromS3(key)));
}