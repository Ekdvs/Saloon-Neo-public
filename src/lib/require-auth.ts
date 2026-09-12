import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

export const requireAuth = async (request: NextRequest) =>{
  const auth = await getCurrentUser(request);

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
        response: errorResponse(
          "Authentication required",
          null,
          401,
        ),
      };

    case "TOKEN_EXPIRED":
      return {
        user: null,
        response: errorResponse(
          "Access token expired. Please refresh your token.",
          null,
          401,
        ),
      };

    case "INVALID_ACCESS_TOKEN":
      return {
        user: null,
        response: errorResponse(
          "Unauthorized. Invalid access token.",
          null,
          401,
        ),
      };

    case "INVALID_TOKEN_PAYLOAD":
      return {
        user: null,
        response: errorResponse(
          "Unauthorized. Invalid token payload.",
          null,
          401,
        ),
      };

    case "USER_NOT_FOUND":
      return {
        user: null,
        response: errorResponse(
          "Unauthorized. User not found.",
          null,
          401,
        ),
      };

    case "ACCOUNT_NOT_ACTIVE":
      return {
        user: null,
        response: errorResponse(
          `Your account is ${auth.status?.toLowerCase()}.`,
          null,
          403,
        ),
      };

    default:
      return {
        user: null,
        response: errorResponse(
          "Authentication failed.",
          null,
          401,
        ),
      };
  }
}

export const isPrivileged = async (
  request: NextRequest,
  requiredPrivileges: string[],
) => {
  const auth = await requireAuth(request);

  if (!auth.user) {
    return {
      authorized: false,
      response: auth.response,
    };
  }

  const authorized = requiredPrivileges.some((privilege) =>
    auth.user.privileges.includes(privilege),
  );

  if (!authorized) {
    return {
      authorized: false,
      response: errorResponse(
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
