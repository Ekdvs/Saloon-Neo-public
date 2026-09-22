import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/jwt";
import { accessTokenPayloadSchema } from "./validations/auth.validation";
import { RequestUser } from "./type/requestUser";

export type AuthError =
    | "AUTHENTICATION_REQUIRED"
    | "INVALID_TOKEN_PAYLOAD"
    | "TOKEN_EXPIRED"
    | "INVALID_ACCESS_TOKEN"
    | "USER_NOT_FOUND"
    | "ACCOUNT_NOT_ACTIVE"
    | "AUTHENTICATION_ERROR";

export interface CurrentUserResult {
    user: RequestUser | null;
    error: AuthError | null;
    status: string | null;
}

export const getCurrentUser = async (
    request: NextRequest,
): Promise<CurrentUserResult> => {
    const accessToken = request.cookies.get("accessToken")?.value;

    // No access token
    if (!accessToken) {
        return {
            user: null,
            error: "AUTHENTICATION_REQUIRED",
            status: null,
        };
    }

    try {
        // Verify access token
        const payload = verifyAccessToken(accessToken);

        // Validate token payload
        const validationPayload =
            accessTokenPayloadSchema.safeParse(payload);

        if (!validationPayload.success) {
            return {
                user: null,
                error: "INVALID_TOKEN_PAYLOAD",
                status: null,
            };
        }

        const { userId } = validationPayload.data;

        // Find user
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

        // User not found
        if (!user) {
            return {
                user: null,
                error: "USER_NOT_FOUND",
                status: null,
            };
        }

        // Account is not active
        if (user.status !== "ACTIVE") {
            return {
                user: null,
                error: "ACCOUNT_NOT_ACTIVE",
                status: user.status,
            };
        }

        // Successfully authenticated
        return {
            user: user as RequestUser,
            error: null,
            status: null,
        };
    } catch (error: unknown) {
        // Access token expired
        if (
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            (error as { name?: string }).name === "TokenExpiredError"
        ) {
            return {
                user: null,
                error: "TOKEN_EXPIRED",
                status: null,
            };
        }

        // Invalid / malformed / tampered token
        if (
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            (error as { name?: string }).name === "JsonWebTokenError"
        ) {
            return {
                user: null,
                error: "INVALID_ACCESS_TOKEN",
                status: null,
            };
        }

        console.error("GET_CURRENT_USER_ERROR:", error);

        return {
            user: null,
            error: "AUTHENTICATION_ERROR",
            status: null,
        };
    }
};

