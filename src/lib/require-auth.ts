
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";
import { RequestUser } from "./type/requestUser";

export interface RequireAuthResult {
    user: RequestUser | null;
    response: NextResponse | null;
}

export const requireAuth = async (
    request: NextRequest,
): Promise<RequireAuthResult> => {
    const auth = await getCurrentUser(request);

    // Authentication successful
    if (auth.user) {
        return {
            user: auth.user,
            response: null,
        };
    }

    switch (auth.error) {
        case "AUTHENTICATION_REQUIRED":
            return {
                user: null,
                response: await errorResponse(
                    "Authentication required.",
                    null,
                    401,
                ),
            };

        case "TOKEN_EXPIRED":
            return {
                user: null,
                response: await errorResponse(
                    "Access token expired. Please refresh your token.",
                    null,
                    401,
                ),
            };

        case "INVALID_ACCESS_TOKEN":
            return {
                user: null,
                response: await errorResponse(
                    "Unauthorized. Invalid access token.",
                    null,
                    401,
                ),
            };

        case "INVALID_TOKEN_PAYLOAD":
            return {
                user: null,
                response: await errorResponse(
                    "Unauthorized. Invalid token payload.",
                    null,
                    401,
                ),
            };

        case "USER_NOT_FOUND":
            return {
                user: null,
                response: await errorResponse(
                    "Unauthorized. User not found.",
                    null,
                    401,
                ),
            };

        case "ACCOUNT_NOT_ACTIVE":
            return {
                user: null,
                response: await errorResponse(
                    `Your account is ${
                        auth.status?.toLowerCase() ?? "inactive"
                    }.`,
                    null,
                    403,
                ),
            };

        case "AUTHENTICATION_ERROR":
        default:
            return {
                user: null,
                response: await errorResponse(
                    "Authentication failed.",
                    null,
                    401,
                ),
            };
    }
};

export interface PrivilegeResult {
    authorized: boolean;
    response: NextResponse | null;
}

export const isPrivileged = async (
    request: NextRequest,
    requiredPrivileges: string[],
): Promise<PrivilegeResult> => {
    const auth = await requireAuth(request);

    // Authentication failed
    if (!auth.user) {
        return {
            authorized: false,
            response: auth.response,
        };
    }

    // Store authenticated user in a local variable.
    // This prevents TypeScript "possibly null" errors.
    const user = auth.user;

    // SUPER_ADMIN has access to everything
    if (user.role === "SUPER_ADMIN") {
        return {
            authorized: true,
            response: null,
        };
    }

    // Check privileges
    const authorized = requiredPrivileges.some((privilege) =>
        user.privileges.includes(privilege),
    );

    // User does not have required privilege
    if (!authorized) {
        return {
            authorized: false,
            response: await errorResponse(
                "Forbidden. You do not have permission to perform this action.",
                null,
                403,
            ),
        };
    }

    return {
        authorized: true,
        response: null,
    };
};

