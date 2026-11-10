import { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { isPrivileged } from "@/lib/require-auth";
import {
  createProductSchema,
} from "@/lib/validations/product.validation";
import { paginationSchema } from "@/lib/validations/pagination.validation";
import {
  deleteManyFromS3,
  getPublicUrl,
  headMedia,
} from "@/lib/s3";
import {
  MEDIA_KEY_REGEX,
  getMediaTypeFromKey,
  getSizeLimit,
} from "@/lib/product-media";

export const runtime = "nodejs";

// Pull valid media keys out of a raw body so they can be cleaned up on failure.
const extractKeys = (body: unknown): string[] => {
  if (!body || typeof body !== "object") return [];
  const media = (body as { media?: unknown }).media;
  if (!Array.isArray(media)) return [];

  return media
    .map((item) => (item as { key?: unknown })?.key)
    .filter(
      (key): key is string =>
        typeof key === "string" && MEDIA_KEY_REGEX.test(key),
    );
};

// ---------------------------------------------------------------
// POST /api/product  (JSON: product fields + uploaded media keys)
// ---------------------------------------------------------------
export const POST = async (request: NextRequest) => {
  let keysToCleanup: string[] = [];
  let committed = false;

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

    // From here on, any failure removes the uploaded files from S3.
    keysToCleanup = extractKeys(body);

    const validation = createProductSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        "Validation failed",
        validation.error.flatten().fieldErrors,
        422,
      );
    }

    const { media, ...productData } = validation.data;

    // Duplicate keys
    const keys = media.map((item) => item.key);
    if (new Set(keys).size !== keys.length) {
      return errorResponse("Duplicate media files are not allowed", null, 400);
    }

    // Verify every file really exists in S3 and respects size limits
    const verifiedMedia: { key: string; type: "IMAGE" | "VIDEO" }[] = [];

    for (const key of keys) {
      const type = getMediaTypeFromKey(key);
      const head = await headMedia(key);

      if (!type || !head) {
        return errorResponse(
          "One or more media files were not uploaded correctly",
          null,
          400,
        );
      }

      if (head.size > getSizeLimit(type)) {
        return errorResponse("A media file exceeds the size limit", null, 400);
      }

      verifiedMedia.push({ key, type });
    }

    // Duplicate SKU
    const existing = await prisma.product.findUnique({
      where: { sku: productData.sku },
      select: { id: true },
    });

    if (existing) {
      return errorResponse(
        "Product with the same SKU already exists",
        { sku: ["SKU already exists"] },
        409,
      );
    }

    const newProduct = await prisma.product.create({
      data: {
        ...productData,
        media: {
          create: verifiedMedia.map((item, index) => ({
            url: getPublicUrl(item.key),
            type: item.type,
            sortOrder: index,
          })),
        },
      },
      include: {
        media: { orderBy: { sortOrder: "asc" } },
      },
    });

    committed = true;

    return successResponse("Product created successfully", newProduct, 201);
  } catch (error) {
    console.error("Error in POST /api/product:", error);

    // Race condition on unique SKU
    if ((error as { code?: string })?.code === "P2002") {
      return errorResponse(
        "Product with the same SKU already exists",
        { sku: ["SKU already exists"] },
        409,
      );
    }

    return errorResponse("An unexpected error occurred", null, 500);
  } finally {
    if (!committed) {
      await deleteManyFromS3(keysToCleanup);
    }
  }
};

//get all products for admin
export const GET = async (request: NextRequest) => {
    try {

        const { authorized, response } = await isPrivileged(request, ['product:read']);

        if (!authorized) {
            return response;
        }

        //add pagination and filtering logic here if needed in the future
        const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

        const result = paginationSchema.safeParse(searchParams);

        if (!result.success) {
            return errorResponse(
                "Pagination validation failed",
                result.error.flatten().fieldErrors,
                422
            );
        }

        const { page, limit } = result.data;

        const skip = (page - 1) * limit;

        //skip delete products from the list
        const where = {
            status: {
                not: "DELETED" as const
            }
        };

        //get all products with pagination
        const [products, totalProducts] = await Promise.all(
            [
                prisma.product.findMany({
                    skip,
                    take: limit,
                    where,
                    include: { media: true },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }),
                prisma.product.count(
                    {where}
                )
            ]
        )

        const totalPages = Math.ceil(totalProducts / limit);

        if (page > totalPages && totalProducts > 0) {
            return errorResponse(
                "Page number exceeds total pages",
                null,
                400
            );
        }

        return successResponse(
            "Products fetched successfully",
            {
                products,
                pagination: {
                    currentPage: page,
                    pageSize: limit,
                    totalPages,
                    totalProducts,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            }
        )

    } catch (error) {
        console.error("Error in GET /api/product:", error);
        return errorResponse(
            "An unexpected error occurred",
            error,
            500
        );
    }
}
