import { z } from "zod";

export const userIdSchema = z.object({
    id: z
        .string()
        .trim()
        .uuid("Invalid user ID"),
});

export type UserIdInput = z.infer<typeof userIdSchema>;