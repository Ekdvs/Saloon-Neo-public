import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/jwt";
import { accessTokenPayloadSchema } from "./validations/auth.validation";

export const getCurrentUser = async (request: NextRequest) => {
  const accessToken =
    request.cookies.get("accessToken")?.value;

  // No access token
  if (!accessToken) {
    return {
      user: null,
      error: "AUTHENTICATION_REQUIRED",
    };
  }

  try {
    const payload = verifyAccessToken(accessToken);

    const validationPayload =
      accessTokenPayloadSchema.safeParse(payload);

    if (!validationPayload.success) {
      return {
        user: null,
        error: "INVALID_TOKEN_PAYLOAD",
      };
    }

    const { userId } = validationPayload.data;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
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
      return {
        user: null,
        error: "USER_NOT_FOUND",
      };
    }

    if (user.status !== "ACTIVE") {
      return {
        user: null,
        error: "ACCOUNT_NOT_ACTIVE",
        status: user.status,
      };
    }

    return {
      user,
      error: null,
    };
  } catch (error: unknown) {
    // Access token expired
    if (typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "TokenExpiredError") {
      return {
        user: null,
        error: "TOKEN_EXPIRED",
      };
    }

    // Invalid / malformed / tampered token
    if (typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "JsonWebTokenError") {
      return {
        user: null,
        error: "INVALID_ACCESS_TOKEN",
      };
    }

    console.error("GET_CURRENT_USER_ERROR:", error);

    return {
      user: null,
      error: "AUTHENTICATION_ERROR",
    };
  }
}