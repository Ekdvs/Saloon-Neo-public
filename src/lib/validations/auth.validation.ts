import { z } from "zod";

//login Schema
export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

//register Schema
export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name is too long")
      .regex(
        /^[\p{L}\p{M}' -]+$/u,
        "First name contains invalid characters",
      ),

    lastName: z
      .string()
      .trim()
      .max(50, "Last name is too long")
      .regex(
        /^[\p{L}\p{M}' -]+$/u,
        "Last name contains invalid characters",
      )
      .optional()
      .or(z.literal("")),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address")
      .max(254, "Email address is too long"),

    phone: z
      .string()
      .trim()
      .regex(
        /^\+?[1-9]\d{7,14}$/,
        "Invalid phone number",
      )
      .optional()
      .or(z.literal("")),

    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password is too long")
      .refine(
        (password) => !/\s/.test(password),
        "Password must not contain spaces",
      )
      .refine(
        (password) => /[a-z]/.test(password),
        "Password must contain a lowercase letter",
      )
      .refine(
        (password) => /[A-Z]/.test(password),
        "Password must contain an uppercase letter",
      )
      .refine(
        (password) => /\d/.test(password),
        "Password must contain a number",
      )
      .refine(
        (password) => /[^A-Za-z0-9]/.test(password),
        "Password must contain a special character",
      ),

    confirmPassword: z.string(),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    },
  );

export type RegisterInput = z.infer<typeof registerSchema>;

//email verfiy
export const verifyEmailSchema = z.object({ 
  token: z
  .string()
  .trim()
  .length(64, "Invalid verification token")
  .regex(/^[a-fA-F0-9]{64}$/, "Invalid verification token",), 
}); 

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const accessTokenPayloadSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  email: z.string().email("Invalid email").optional(),
  role: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type AccessTokenPayload = z.infer<
  typeof accessTokenPayloadSchema
>;
