import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
} from "@/lib/api-response";
import { requireAuth } from "@/lib/require-auth";

export const GET = async(request: NextRequest) =>{
  try {
    
    const { user, response } = await requireAuth(request);

    if (response) {
      return response;
    }

    if (!user) { 
      return errorResponse( 
        "Authentication required", 
        null, 
        401, 
      ); 
    }


    return successResponse(
      "User retrieved successfully",
      {
        user,
      },
      200,
    );
  } catch (error) {
    console.error("GET_CURRENT_USER_ERROR:", error);

    return errorResponse(
      "Internal server error",
      null,
      500,
    );
  }
}