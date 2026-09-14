import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { isPrivileged } from "@/lib/require-auth";
import { userIdSchema } from "@/lib/validations/user.validation";
import { NextRequest } from "next/server";

interface RouteContext {
    params: Promise<{
        id: string;
    }>;
}

export const GET = async (request: NextRequest, {params}: RouteContext) => {
    try {
        const { authorized, response } = await isPrivileged
            (request, [
                "user:read",
            ]);

        if (!authorized) {
            return response;
        }

        //find user by id
        const { id } = await params;
        
        // Validate the user ID
        const validation = userIdSchema.safeParse({ id });

        if (!validation.success) {
            return errorResponse(
                "Invalid user ID",
                null,
                400,
            );
        }

        if (!id) {
            return errorResponse(
                "User id is required",
                null,
                400,
            );
        }

        // Implement the logic to find the user by ID
        const user = await prisma.user.findUnique({
            where: {
                id
            },
        });

        if (!user) {
            return errorResponse(
                "User not found",
                null,
                404,
            );
        }

        return successResponse(
            "User fetched successfully",
            {
                user,
            },
            200,
        );  


    }
    catch (error) {
        console.error("GET /api/users/[id] error:", error);

        return errorResponse(
            "Failed to fetch users",
            null,
            500,
        );
    }

}