import { z } from "zod";

export const userIdSchema = z.object({
  id: z
    .string()
    .trim()
    .uuid("Invalid user ID"),
});

export type UserIdInput = z.infer<typeof userIdSchema>;

export const userRoleSchema = z.enum([
  "CUSTOMER",
  "STAFF",
  "SALON_OWNER",
  "ADMIN",
]);

export type UserRole = z.infer<typeof userRoleSchema>;

export const userStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "BANNED",
]);

export type UserStatus = z.infer<typeof userStatusSchema>;

export const updateUserSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(100, "First name cannot exceed 100 characters")
      .optional(),

    lastName: z
      .string()
      .trim()
      .min(1, "Last name cannot be empty")
      .max(100, "Last name cannot exceed 100 characters")
      .nullable()
      .optional(),

    phone: z
      .string()
      .trim()
      .min(7, "Phone number is too short")
      .max(20, "Phone number cannot exceed 20 characters")
      .nullable()
      .optional(),

    avatar: z
      .string()
      .trim()
      .url("Avatar must be a valid URL")
      .optional(),

    role: userRoleSchema.optional(),

    status: userStatusSchema.optional(),

    privileges: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Privilege cannot be empty")
          .max(100, "Privilege cannot exceed 100 characters"),
      )
      .max(100, "Cannot have more than 100 privileges")
      .optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;