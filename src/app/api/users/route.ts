import { successResponse, errorResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { isPrivileged } from "@/lib/require-auth";
import { paginationSchema } from "@/lib/validations/pagination.validation";
import { NextRequest } from "next/server";


export const GET = async (request: NextRequest) => {
  try {
    const { authorized, response } = await isPrivileged(request, [
      "user:read",
    ]);

    if (!authorized) {
      return response;
    }

    //get pagination parameters from query string
    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );

    const result = paginationSchema.safeParse(searchParams);

    if (!result.success) {
      console.log("Validation errors:", result.error.flatten());

      return errorResponse(
        "Invalid pagination parameters",
        result.error.flatten(),
        400,
      );
    }

    const { page, limit } = result.data;

    const skip = (page - 1) * limit;

    //fetch users + total count in parallel
    const [users, totalUsers] = await Promise.all(
      [
        prisma.user.findMany({
          skip,
          take: limit,

          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            role: true,
            status: true,
            emailVerified: true,
            privileges: true,
            createdAt: true,
            updatedAt: true,
            lastLogin: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.user.count(),
      ]
    );

    const totalPages = Math.ceil(totalUsers / limit);

    if (page > totalPages && totalUsers > 0) {
      return errorResponse(
        "Page number exceeds total pages",
        null,
        400,
      );
    }


    return successResponse(
      "Users fetched successfully",

      {
        users,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalUsers,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrviousPage: page > 1,

        }
      },
      200,
    );
  } catch (error) {
    console.error("GET /api/users error:", error);

    return errorResponse(
      "Failed to fetch users",
      null,
      500,
    );
  }
};