import { Prisma, ProductStatus } from "@/generated/prisma/client";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { isPrivileged } from "@/lib/require-auth";
import { createPresignedDownload, deleteManyFromS3, headMedia } from "@/lib/s3";
import {
    MEDIA_KEY_REGEX,
    getMediaTypeFromKey,
    getSizeLimit,
} from "@/lib/product-media";
import { productIdSchema, updateProductSchema } from "@/lib/validations/product.validation";
import { NextRequest } from "next/server";
interface RouteContext {
    params: Promise<{
        id: string;
    }>;
}
//get product by id

export const GET = async (
    request: NextRequest,
    { params }: RouteContext
) => {
    try {
        const { id } = await params;

        // Validate product ID
        const validation = productIdSchema.safeParse({ id });

        if (!validation.success) {
            return errorResponse(
                "Invalid product ID",
                validation.error,
                400
            );
        }

        const productId = validation.data.id;

        // Find product with media
        const product = await prisma.product.findUnique({
            where: {
                id: productId,
            },
            include: {
                media: true,
            },
        });

        if (!product) {
            return errorResponse(
                "Product not found",
                null,
                404
            );
        }

        if (product.status === ProductStatus.DELETED) {
            return errorResponse(
                "Product has been deleted",
                null,
                410
            );
        }

        // Check permission for inactive products
        if (product.status === ProductStatus.INACTIVE) {
            const { authorized, response } = await isPrivileged(
                request,
                ["product:read"]
            );

            if (!authorized) {
                return errorResponse(
                    "Product is inactive",
                    response,
                    403
                );
            }
        }

        // Generate temporary signed URLs for private S3 media

        const mediaWithUrls = await Promise.all(
            product.media.map(async (item) => {
                // Your Prisma schema stores the S3 key in the `url` field.
                // Support both stored S3 keys and older full S3 URLs.
                const mediaKey = item.url.startsWith("http")
                    ? decodeURIComponent(
                        new URL(item.url).pathname.replace(/^\/+/, "")
                    )
                    : item.url;

                const { url, expiresIn } =
                    await createPresignedDownload(mediaKey);

                return {
                    ...item,
                    key: mediaKey,
                    url,
                    expiresIn,
                };
            })
        );


        // Return product with signed media URLs
        const productWithMedia = {
            ...product,
            media: mediaWithUrls,
        };

        return successResponse(
            "Product retrieved successfully",
            productWithMedia,
            200
        );

    } catch (error) {
        console.error(
            "Error in GET /api/product/[id]:",
            error
        );

        return errorResponse(
            "An unexpected error occurred",
            error,
            500
        );
    }
};

//delete product by id
export const DELETE = async (request: NextRequest, { params }: RouteContext) => {
    try {
        const { authorized, response } = await isPrivileged(request, ['product:delete']);

        if (!authorized) {
            return response;
        }

        const { id } = await params;


        const validation = productIdSchema.safeParse({ id });

        if (!validation.success) {
            return errorResponse(
                "Invalid product ID",
                validation.error,
                400
            );
        }

        const productId = validation.data.id;

        const product = await prisma.product.findUnique({
            where: {
                id: productId
            },

        });

        if (!product) {
            return errorResponse(
                "Product not found",
                null,
                404
            );
        }

        if (product.status === ProductStatus.DELETED) {
            return errorResponse(
                "Product has already been deleted",
                null,
                410
            );
        }

        // Update the product status to "DELETED"
        const deletedProduct = await prisma.product.update({
            where: {
                id: productId
            },
            data: {
                status: ProductStatus.DELETED
            }
        });

        return successResponse(
            "Product deleted successfully",
            deletedProduct,
            200
        );

    } catch (error) {
        console.error("Error in Delete /api/product/[id]:", error);
        return errorResponse(
            "An unexpected error occurred",
            error,
            500
        );
    }
}

// Normalise stored value (S3 key or legacy full URL) to an S3 key
const toS3Key = (value: string) =>
    value.startsWith("http")
        ? decodeURIComponent(new URL(value).pathname.replace(/^\/+/, ""))
        : value;

// Pull valid media keys from a raw body so they can be cleaned up on failure
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

// Update product by ID
export const PUT = async (request: NextRequest, { params }: RouteContext) => {
    let newKeys: string[] = [];
    let removedKeys: string[] = [];
    let committed = false;

    try {
        const { authorized, response } = await isPrivileged(request, ["product:update"]);
        if (!authorized) return response;

        const { id } = await params;

        const idValidation = productIdSchema.safeParse({ id });
        if (!idValidation.success) {
            return errorResponse(
                "Invalid product ID",
                idValidation.error.flatten().fieldErrors,
                400,
            );
        }
        const productId = idValidation.data.id;

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return errorResponse("Invalid request body", null, 400);
        }

        // From here on, any failure removes newly uploaded files from S3
        newKeys = extractKeys(body);

        const validationData = updateProductSchema.safeParse(body);
        if (!validationData.success) {
            console.error("Validation failed for product update:", validationData.error);
            return errorResponse(
                "Invalid product data",
                validationData.error.flatten().fieldErrors,
                422,
            );
        }

        const data = validationData.data;

        const existingProduct = await prisma.product.findUnique({
            where: { id: productId },
            include: { media: true },
        });

        if (!existingProduct) {
            return errorResponse("Product not found", null, 404);
        }

        if (existingProduct.status === ProductStatus.DELETED) {
            return errorResponse("Cannot update a deleted product", null, 410);
        }

        // SKU uniqueness
        if (data.sku !== undefined && data.sku !== existingProduct.sku) {
            const existingSku = await prisma.product.findUnique({
                where: { sku: data.sku },
                select: { id: true },
            });

            if (existingSku) {
                return errorResponse(
                    "Product with the same SKU already exists",
                    { sku: ["SKU already exists"] },
                    409,
                );
            }
        }

        const { media, ...productData } = data;

        // compareAtPrice must be greater than price (using final values)
        const finalPrice = data.price ?? Number(existingProduct.price);
        const finalCompare =
            data.compareAtPrice !== undefined
                ? data.compareAtPrice
                : existingProduct.compareAtPrice !== null
                    ? Number(existingProduct.compareAtPrice)
                    : null;

        if (finalCompare !== null && finalCompare <= finalPrice) {
            return errorResponse(
                "Invalid product data",
                { compareAtPrice: ["Compare-at price must be greater than the selling price"] },
                422,
            );
        }

        const updateData: Prisma.ProductUpdateInput = { ...productData };

        // Stock = 0 → automatically INACTIVE
        if (data.stock === 0) {
            updateData.status = ProductStatus.INACTIVE;
        }

        // Media: keep by id, delete the rest, create new uploads
        if (media !== undefined) {
            const existingIds = new Set(existingProduct.media.map((m) => m.id));
            const keepIds = new Set<string>();
            const seenKeys = new Set<string>();

            const keepItems: { id: string; sortOrder: number }[] = [];
            const newItems: { key: string; type: "IMAGE" | "VIDEO"; sortOrder: number }[] = [];

            for (const [index, item] of media.entries()) {
                if ("id" in item) {
                    if (!existingIds.has(item.id) || keepIds.has(item.id)) {
                        return errorResponse("Invalid media reference", null, 400);
                    }
                    keepIds.add(item.id);
                    keepItems.push({ id: item.id, sortOrder: index });
                } else {
                    if (seenKeys.has(item.key)) {
                        return errorResponse("Duplicate media files are not allowed", null, 400);
                    }
                    seenKeys.add(item.key);

                    const type = getMediaTypeFromKey(item.key);
                    const head = await headMedia(item.key);

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

                    newItems.push({ key: item.key, type, sortOrder: index });
                }
            }

            const removed = existingProduct.media.filter((m) => !keepIds.has(m.id));
            removedKeys = removed.map((m) => toS3Key(m.url));

            updateData.media = {
                deleteMany: { id: { in: removed.map((m) => m.id) } },
                update: keepItems.map((item) => ({
                    where: { id: item.id },
                    data: { sortOrder: item.sortOrder },
                })),
                create: newItems.map((item) => ({
                    url: item.key,
                    type: item.type,
                    sortOrder: item.sortOrder,
                })),
            };
        }

        const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: updateData,
            include: { media: { orderBy: { sortOrder: "asc" } } },
        });

        committed = true;

        // Remove deleted media files from S3 (never fail the request for this)
        if (removedKeys.length > 0) {
            try {
                await deleteManyFromS3(removedKeys);
            } catch (cleanupError) {
                console.error("Failed to delete old media from S3:", cleanupError);
            }
        }

        return successResponse("Product updated successfully", updatedProduct, 200);
    } catch (error) {
        console.error("Error in PUT /api/product/[id]:", error);

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
            await deleteManyFromS3(newKeys);
        }
    }
};