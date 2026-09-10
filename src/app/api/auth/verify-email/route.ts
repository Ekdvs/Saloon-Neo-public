import { NextRequest } from "next/server";
import crypto from "crypto";

import prisma from "@/lib/prisma";

import { verifyEmailSchema } from "@/lib/validations/auth.validation";

import {
    successResponse,
    errorResponse,
} from "@/lib/api-response";


export const POST = async (request: NextRequest) => {
    try {

        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return errorResponse(
                "Invalid request body",
                null,
                400,
            );
        }

        const validation =
            verifyEmailSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(
                "Invalid verification token",
                null,
                422,
            );
        }

        const { token } = validation.data;


        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const verificationToken =
            await prisma.emailVerificationToken.findUnique({
                where: {
                    tokenHash,
                },

                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            emailVerified: true,
                            status: true,
                        },
                    },
                },
            });



        if (!verificationToken) {
            return errorResponse(
                "Invalid or expired verification token",
                null,
                400,
            );
        }


        if (
            verificationToken.expiresAt.getTime() <
            Date.now()
        ) {

            await prisma.emailVerificationToken.delete({
                where: {
                    id: verificationToken.id,
                },
            });

            return errorResponse(
                "Verification token has expired",
                null,
                400,
            );
        }


        if (verificationToken.user.emailVerified) {


            await prisma.emailVerificationToken.delete({
                where: {
                    id: verificationToken.id,
                },
            });

            return successResponse(
                "Email is already verified",
                null,
                200,
            );
        }


        const verifiedUser =
            await prisma.$transaction(async (tx) => {
                /*
                 * Update user
                 */
                const user = await tx.user.update({
                    where: {
                        id: verificationToken.userId,
                    },

                    data: {
                        emailVerified: true,

                        status: "ACTIVE",
                    },

                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        status: true,
                        emailVerified: true,
                        createdAt: true,
                    },
                });


                await tx.emailVerificationToken.delete({
                    where: {
                        id: verificationToken.id,
                    },
                });


                return user;
            });


        return successResponse(
            "Email verified successfully",
            {
                user: verifiedUser,
            },
            200,
        );


    } catch (error) {

        console.error(
            "VERIFY_EMAIL_ERROR:",
            error,
        );

        return errorResponse(
            "Unable to verify email",
            null,
            500,
        );
    }
}

