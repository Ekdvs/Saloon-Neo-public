export const MAX_FILES = 10;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

export type MediaKind = "IMAGE" | "VIDEO";

export const MIME_EXTENSIONS: Record<string, { ext: string; type: MediaKind }> = {
  "image/jpeg": { ext: "jpg", type: "IMAGE" },
  "image/png": { ext: "png", type: "IMAGE" },
  "image/webp": { ext: "webp", type: "IMAGE" },
  "image/gif": { ext: "gif", type: "IMAGE" },
  "image/avif": { ext: "avif", type: "IMAGE" },
  "video/mp4": { ext: "mp4", type: "VIDEO" },
  "video/webm": { ext: "webm", type: "VIDEO" },
  "video/quicktime": { ext: "mov", type: "VIDEO" },
};

export const MEDIA_KEY_REGEX =
  /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif|mp4|webm|mov)$/;

export const getSizeLimit = (type: MediaKind) =>
  type === "IMAGE" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

export const getMediaTypeFromKey = (key: string): MediaKind | null => {
  const ext = key.split(".").pop();
  const entry = Object.values(MIME_EXTENSIONS).find((m) => m.ext === ext);
  return entry?.type ?? null;
};