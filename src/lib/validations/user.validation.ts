import { z } from "zod";

export const userIdSchema = z.object({
  userId: z
    .string()
    .uuid("Invalid user ID"),
});

export type UserIdInput = z.infer<typeof userIdSchema>;