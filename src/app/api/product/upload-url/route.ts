import { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import { isPrivileged } from "@/lib/require-auth";
import { createPresignedUpload } from "@/lib/s3";
import { MIME_EXTENSIONS, getSizeLimit } from "@/lib/product-media";
import { uploadUrlRequestSchema } from "@/lib/validations/product.validation";

export const runtime = "nodejs";

export const POST = async (request: NextRequest) => {
  try {
    const { authorized, response } = await isPrivileged(request, [
      "product:create",
    ]);
    if (!authorized) return response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", null, 400);
    }

    const validation = uploadUrlRequestSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        "Validation failed",
        validation.error.flatten().fieldErrors,
        422,
      );
    }

    const { files } = validation.data;

    for (const file of files) {
      const info = MIME_EXTENSIONS[file.contentType];

      if (!info) {
        return errorResponse(
          `Unsupported file type: ${file.contentType}`,
          null,
          400,
        );
      }

      const limit = getSizeLimit(info.type);
      if (file.size > limit) {
        return errorResponse(
          `${info.type === "IMAGE" ? "Images" : "Videos"} must be under ${
            limit / (1024 * 1024)
          } MB`,
          null,
          400,
        );
      }
    }

    const uploads = await Promise.all(
      files.map((file) => createPresignedUpload(file.contentType)),
    );

    return successResponse("Upload URLs created", { uploads }, 200);
  } catch (error) {
    console.error("Error in POST /api/product/upload-url:", error);
    return errorResponse("Failed to create upload URLs", null, 500);
  }
};