import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { isPrivileged } from "@/lib/require-auth";
import { paginationSchema } from "@/lib/validations/pagination.validation";
import {  createProductSchema } from "@/lib/validations/product.validation";
import { NextRequest } from "next/server";

//add products
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

//get all products for admin
export const GET = async (request: NextRequest) => {
    try {

        const {authorized, response} = await isPrivileged(request, ['product:read']);

        if(!authorized){
            return response;
        }

        //add pagination and filtering logic here if needed in the future
        const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

        const result = paginationSchema.safeParse(searchParams);

        if(!result.success){
            return errorResponse(
                "Pagination validation failed",
                result.error.flatten().fieldErrors,
                422
            );
        }

        const { page, limit } = result.data;

        const skip = (page - 1) * limit;

        //get all products with pagination
        const[products, totalProducts] = await Promise.all(
            [
                prisma.product.findMany({
                    skip,
                    take:limit,
                    orderBy:{
                        createdAt: 'desc'
                    }
                }),
                prisma.product.count()
            ]
        )

        const totalPages = Math.ceil(totalProducts / limit);

        if(page > totalPages && totalProducts > 0){
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
