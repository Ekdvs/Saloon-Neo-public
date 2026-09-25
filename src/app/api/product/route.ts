import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { isPrivileged } from "@/lib/require-auth";
import {  createProductSchema } from "@/lib/validations/product.validation";
import { NextRequest } from "next/server";


export const POST = async (request: NextRequest) => {
    try{

        const {authorized, response} = await isPrivileged(request, ['product:create']);

        if(!authorized){
            return response;
        }

        let body:unknown;

        try{
            body = await request.json();
        }
        catch{
            return errorResponse(
                "Invalid request body",
                null,
                400
            );
        }
        //validate the request body using zod
        const validation = createProductSchema.safeParse(body);

        if(!validation.success){
            return errorResponse(
                "Validation failed",
                validation.error.flatten().fieldErrors,
                422
            );
        }

        //check if product with the same SKU already exists
        const existingProduct = await prisma.product.findUnique(
            {
                where: {
                    sku: validation.data.sku
                }
            }
        )

        if(existingProduct){
            return errorResponse(
                "Product with the same SKU already exists",
                null,
                409
            );
        }

        // Separate media from product fields
        const { media, ...productData } = validation.data;

        // Create the new product
        const newProduct = await prisma.product.create(
            {
                data: {
                    ...productData,
                    media: {
                        create: media
                    }
                }
            }
        )

        return successResponse(
            "Product created successfully",
            newProduct,
            201
        );

    }
    catch (error) {
        console.error("Error in POST /api/product:", error);
        return errorResponse(
            "An unexpected error occurred",
            error,
            500
        );

    }

}

export const GET = async (request: NextRequest) => {
    try {
        const { authorized, response } = await isPrivileged(request, ['product:create']);

        if (!authorized) {
            return response;
        }

        const products = await prisma.product.findMany();

        return successResponse(
            "Products retrieved successfully",
            products,
            200
        );
    } catch (error) {
        console.error("Error in GET /api/product:", error);
        return errorResponse(
            "An unexpected error occurred",
            error,
            500
        );
    }
}
