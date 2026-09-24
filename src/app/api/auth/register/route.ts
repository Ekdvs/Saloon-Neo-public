import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { RegisterInput, registerSchema } from "@/lib/validations/auth.validation";
import {
  successResponse,
  errorResponse,
} from "@/lib/api-response";

import prisma from "@/lib/prisma";

const BCRYPT_ROUNDS = 12;

// Verification link validity
const VERIFICATION_TOKEN_TTL = 15 * 60 * 1000; // 15 minutes

export const POST = async(request: NextRequest) => {
  try {

    let body:RegisterInput;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Invalid request body",
        null,
        400,
      );
    }

    //validate the body using zod
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(
        "Validation failed",
        validation.error.flatten().fieldErrors,
        422,
      );
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      password,
    } = validation.data;

    const normalizedEmail = email.trim().toLowerCase();

    const normalizedPhone =
      phone && phone.trim().length > 0
        ? phone.trim()
        : null;

    const normalizedLastName =
      lastName && lastName.trim().length > 0
        ? lastName.trim()
        : null;

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        emailVerified: true,
      },
    });

    if (existingUser) {

      return successResponse(
        "If this email can be registered, a verification email will be sent.",
        null,
        201,
      );
    }

    if (normalizedPhone) {
      const existingPhone = await prisma.user.findUnique({
        where: {
          phone: normalizedPhone,
        },
        select: {
          id: true,
        },
      });

      if (existingPhone) {
        return successResponse(
          "If this information can be registered, a verification email will be sent.",
          null,
          201,
        );
      }
    }

    const passwordHash = await bcrypt.hash(
      password,
      BCRYPT_ROUNDS,
    );

    const verificationToken =
      crypto.randomBytes(32).toString("hex");


    const verificationTokenHash =
      crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex");

    const expiresAt = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL,
    );

    const user = await prisma.$transaction(
      async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: passwordHash,

            firstName: firstName.trim(),
            lastName: normalizedLastName,
            phone: normalizedPhone,


            role: "CUSTOMER",
            status: "INACTIVE",
            privileges: [],

            emailVerified: false,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        });

        await tx.emailVerificationToken.create({
          data: {
            tokenHash: verificationTokenHash,
            userId: newUser.id,
            expiresAt,
          },
        });

        return newUser;
      },
    );

    // --------------------------------------------------
    // 9. Send verification email
    // --------------------------------------------------

    /*
     * IMPORTANT:
     *
     * Do not log verificationToken.
     *
     * Send this through your email service:
     *
     * https://your-domain.com/api/auth/verify-email?token=...
     *
     * Prefer sending the email through a background job/queue
     * rather than delaying the HTTP response.
     */

    const verificationUrl =
      `${process.env.NEXT_PUBLIC_APP_URL}` +
      `/verify-email?token=${verificationToken}`;

    /*
     * TODO:
     *
     * await sendVerificationEmail({
     *   email: user.email,
     *   firstName: user.firstName,
     *   verificationUrl,
     * });
     */

    // Prevent accidental unused-variable removal
    void verificationUrl;

    return successResponse(
      "Registration successful. Please check your email to verify your account.",
      {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
        },
      },
      201,
    );
  } catch (error) {
    console.error("REGISTER_ERROR:", error);

    return errorResponse(
      "Unable to complete registration",
      null,
      500,
    );
  }
}
