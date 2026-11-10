
import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
  "http://localhost:3001",
];

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Allow requests without Origin (Postman)
  // Validate browser origins when Origin exists
  if (origin && !allowedOrigins.includes(origin)) {
    return new NextResponse("Forbidden", {
      status: 403,
    });
  }

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...(origin
          ? { "Access-Control-Allow-Origin": origin }
          : {}),
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods":
          "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      },
    });
  }

  const response = NextResponse.next();

  if (origin) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      origin
    );
    response.headers.set(
      "Access-Control-Allow-Credentials",
      "true"
    );
    response.headers.set("Vary", "Origin");
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
