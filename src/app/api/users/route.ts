import { successResponse, errorResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { isPrivileged } from "@/lib/require-auth";
import { NextRequest } from "next/server";

export const GET = async (request: NextRequest) => {
  try {
    const { authorized, response } = await isPrivileged(request, [
      "user:read",
    ]);

    if (!authorized) {
      return response;
    }

    const users = await prisma.user.findMany({
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
    });

    return successResponse(
      "Users fetched successfully",
      {
        users,
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