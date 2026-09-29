import { Prisma } from "@/generated/prisma/client";
import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { isPrivileged } from "@/lib/require-auth";
import { productIdSchema, UpdateProductInput, updateProductSchema } from "@/lib/validations/product.validation";
import { NextRequest } from "next/server";



interface RouteContext {
    params: Promise<{
        id: string;
    }>;
}
//get product by id
export const GET = async (request: NextRequest, { params }: RouteContext) => {
    try{
        const { id } = await params;
        //console.log("Fetching product with ID:", id);
        
        const validation = productIdSchema.safeParse({ id });

        if (!validation.success) {
            return errorResponse(
                "Invalid product ID",
                validation.error,
                400
            );
        }

        // Proceed with fetching the product
        const productId = validation.data.id;

        const product = await prisma.product.findUnique({
            
            where: {
                id: productId
            },
            include:{media:true},
        }); 

        if (!product) {
            return errorResponse(
                "Product not found",
                null,
                404
            );
        }

        if (product.status === "DELETED") {
            return errorResponse(
                "Product has been deleted",
                null,
                410
            );
        }

        if (product.status === "INACTIVE") {
            return errorResponse(
                "Product is inactive",
                null,
                403
            );
        }

        return successResponse(
            "Product retrieved successfully",
            product,
            200
        );

    }
    catch (error) {
        console.error("Error in GET /api/product/[id]:", error);
        return errorResponse(
            "An unexpected error occurred",
            error,
            500
        );
    }
}

//delete product by id
export const DELETE = async (request:NextRequest, { params }: RouteContext) => {
    try{
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

        if (product.status === "DELETED") {
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
                status: "DELETED"
            }
        });

        return successResponse(
            "Product deleted successfully",
            deletedProduct,
            200
        );

    }catch(error){
        console.error("Error in Delete /api/product/[id]:", error);
        return errorResponse(
            "An unexpected error occurred",
            error,
            500
        );
    }
}

// Update product by ID
export const PUT = async (
    request: NextRequest,
    { params }: RouteContext
) => {
    try {
        // Check authorization
        const { authorized, response } = await isPrivileged(
            request,
            ["product:update"]
        );

        if (!authorized) {
            return response;
        }

        // Get product ID
        const { id } = await params;

        // Validate product ID
        const idValidation = productIdSchema.safeParse({ id });

        if (!idValidation.success) {
            return errorResponse(
                "Invalid product ID",
                idValidation.error.flatten().fieldErrors,
                400
            );
        }

        const productId = idValidation.data.id;

        // Parse request body
        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return errorResponse(
                "Invalid request body",
                null,
                400
            );
        }

        // Validate update data
        const validationData = updateProductSchema.safeParse(body);

        if (!validationData.success) {
            return errorResponse(
                "Invalid product data",
                validationData.error.flatten().fieldErrors,
                422
            );
        }

        const data = validationData.data;

        // Find existing product
        const existingProduct = await prisma.product.findUnique({
            where: {
                id: productId,
            },
        });

        if (!existingProduct) {
            return errorResponse(
                "Product not found",
                null,
                404
            );
        }

        // Do not allow updating deleted products
        if (existingProduct.status === "DELETED") {
            return errorResponse(
                "Cannot update a deleted product",
                null,
                410
            );
        }

        // Check SKU uniqueness if SKU is being changed
        if (
            data.sku !== undefined &&
            data.sku !== existingProduct.sku
        ) {
            const existingSku = await prisma.product.findUnique({
                where: {
                    sku: data.sku,
                },
            });

            if (existingSku) {
                return errorResponse(
                    "Product with the same SKU already exists",
                    null,
                    409
                );
            }
        }

        // Separate media from normal product fields
        const { media, ...productData } = data;

        // Prisma update data
        const updateData: Prisma.ProductUpdateInput = {
            ...productData,
        };

        // Stock = 0 → automatically INACTIVE
        if (data.stock === 0) {
            updateData.status = "INACTIVE";
        }

        // Update media only when media is provided
        if (media !== undefined) {
            updateData.media = {
                deleteMany: {},
                create: media,
            };
        }

        // Update product
        const updatedProduct = await prisma.product.update({
            where: {
                id: productId,
            },
            data: updateData,
            include: {
                media: true,
            },
        });

        return successResponse(
            "Product updated successfully",
            updatedProduct,
            200
        );

    } catch (error) {
        console.error(
            "Error in PUT /api/product/[id]:",
            error
        );

        return errorResponse(
            "An unexpected error occurred",
            error,
            500
        );
    }
};