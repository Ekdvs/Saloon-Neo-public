import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { LoginInput, loginSchema } from "@/lib/validations/auth.validation";
import {
  generateAccessToken,
  generateRefreshToken,
} from "@/lib/jwt";

import {
  successResponse,
  errorResponse,
} from "@/lib/api-response";

import prisma from "@/lib/prisma";

export const POST = async(request: NextRequest) =>{
  try {
    let body:LoginInput;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Invalid request body",
        null,
        400,
      );
    }

    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(
        "Validation failed",
        validation.error.flatten().fieldErrors,
        422,
      );
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return errorResponse(
        "Invalid email or password",
        null,
        401,
      );
    }

    if (!user.password) {
      return errorResponse(
        "This account does not have a password. Please use the appropriate authentication method.",
        null,
        401,
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordValid) {
      return errorResponse(
        "Invalid email or password",
        null,
        401,
      );
    }

    if (user.status !== "ACTIVE") {
      return errorResponse(
        `Your account is ${user.status.toLowerCase()}`,
        null,
        403,
      );
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    const loginTime = new Date();

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLogin: loginTime,
      },
    });

    const cookieStore = await cookies();

    cookieStore.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    cookieStore.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 60 * 60 * 24 * 30,
    });

    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      privileges: user.privileges,
      lastLogin: loginTime,
    };

    return successResponse(
      "Login successful",
      { data: userData },
      200,
    );
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return errorResponse(
      "Internal server error",
      null,
      500,
    );
  }
}