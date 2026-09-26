import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { productIdSchema } from "@/lib/validations/product.validation";



interface RouteContext {
    params: Promise<{
        id: string;
    }>;
}
//get product by id
export const GET = async (request: Request, { params }: RouteContext) => {
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
            }
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