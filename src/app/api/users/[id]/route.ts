import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import {
  errorResponse,
  successResponse,
} from "@/lib/api-response";
import {
  isPrivileged,
  requireAuth,
} from "@/lib/require-auth";
import {
  updateUserSchema,
  userIdSchema,
} from "@/lib/validations/user.validation";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const GET = async (
  request: NextRequest,
  { params }: RouteContext,
) => {
  try {
    const { id } = await params;

    const validation = userIdSchema.safeParse({ id });

    if (!validation.success) {
      return errorResponse(
        "Invalid user ID.",
        validation.error.flatten(),
        400,
      );
    }

    const auth = await requireAuth(request);

    if (!auth.user) {
      return auth.response;
    }

    const currentUser = auth.user;

    const isOwnProfile = currentUser.id === id;

    if (!isOwnProfile) {
      const authorization = await isPrivileged(
        request,
        ["user:read"],
      );

      if (!authorization.authorized) {
        return authorization.response;
      }
    }

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
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
    });

    if (!user) {
      return errorResponse(
        "User not found.",
        null,
        404,
      );
    }

    return successResponse(
      "User fetched successfully.",
      {
        user,
      },
      200,
    );
  } catch (error) {
    console.error(
      "GET /api/users/[id] error:",
      error,
    );

    return errorResponse(
      "Failed to fetch user.",
      null,
      500,
    );
  }
};

export const PATCH = async (
  request: NextRequest,
  { params }: RouteContext,
) => {
  try {
    const { id } = await params;

    const idValidation = userIdSchema.safeParse({
      id,
    });

    if (!idValidation.success) {
      return errorResponse(
        "Invalid user ID.",
        idValidation.error.flatten(),
        400,
      );
    }

    const auth = await requireAuth(request);

    if (!auth.user) {
      return auth.response;
    }

    const currentUser = auth.user;

    const existingUser = await prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!existingUser) {
      return errorResponse(
        "User not found.",
        null,
        404,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON request body.",
        null,
        400,
      );
    }

    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(
        "Invalid user data.",
        validation.error.flatten(),
        400,
      );
    }

    const data = validation.data;

    const isOwnProfile = currentUser.id === id;

    const hasProfileChanges =
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.phone !== undefined ||
      data.avatar !== undefined;

    const hasRoleChange =
      data.role !== undefined;

    const hasStatusChange =
      data.status !== undefined;

    const hasPrivilegesChange =
      data.privileges !== undefined;

    const hasAdminChanges =
      hasRoleChange ||
      hasStatusChange ||
      hasPrivilegesChange;

    if (!hasProfileChanges && !hasAdminChanges) {
      return errorResponse(
        "No valid fields provided for update.",
        null,
        400,
      );
    }

    if (hasRoleChange) {
      const authorization = await isPrivileged(
        request,
        ["user:role"],
      );

      if (!authorization.authorized) {
        return authorization.response;
      }
    }

    if (hasStatusChange) {
      const authorization = await isPrivileged(
        request,
        ["user:status"],
      );

      if (!authorization.authorized) {
        return authorization.response;
      }
    }

    if (hasPrivilegesChange) {
      const authorization = await isPrivileged(
        request,
        ["user:privileges"],
      );

      if (!authorization.authorized) {
        return authorization.response;
      }
    }

    if (isOwnProfile && hasAdminChanges) {
      return errorResponse(
        "You cannot change your own role, status, or privileges.",
        null,
        403,
      );
    }

    if (!isOwnProfile && hasProfileChanges) {
      const authorization = await isPrivileged(
        request,
        ["user:update"],
      );

      if (!authorization.authorized) {
        return authorization.response;
      }
    }

    const updateData = {
      ...(data.firstName !== undefined && {
        firstName: data.firstName,
      }),

      ...(data.lastName !== undefined && {
        lastName: data.lastName,
      }),

      ...(data.phone !== undefined && {
        phone: data.phone,
      }),

      ...(data.avatar !== undefined && {
        avatar: data.avatar,
      }),

      ...(data.role !== undefined && {
        role: data.role,
      }),

      ...(data.status !== undefined && {
        status: data.status,
      }),

      ...(data.privileges !== undefined && {
        privileges: data.privileges,
      }),
    };

    const updatedUser = await prisma.user.update({
      where: {
        id,
      },

      data: updateData,

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
    });

    return successResponse(
      "User updated successfully.",
      {
        user: updatedUser,
      },
      200,
    );
  } catch (error) {
    console.error(
      "PATCH /api/users/[id] error:",
      error,
    );

    return errorResponse(
      "Failed to update user.",
      null,
      500,
    );
  }
};