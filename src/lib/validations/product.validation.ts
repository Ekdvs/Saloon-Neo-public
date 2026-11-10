import { z } from "zod";

import { MAX_FILES, MEDIA_KEY_REGEX } from "@/lib/product-media";

// Reusable pieces
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} cannot exceed ${max} characters`)
    .nullish()
    .transform((value) => (value ? value : null));

const priceField = z
  .number({ message: "Price must be a number" })
  .min(0, "Price cannot be negative")
  .max(1_000_000, "Price cannot exceed 1,000,000");

const altNameField = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Alternative name cannot be empty")
      .max(200, "Alternative name cannot exceed 200 characters"),
  )
  .max(10, "Cannot have more than 10 alternative names");

// IDs / enums
export const productIdSchema = z.object({
  id: z.string().trim().uuid("Invalid product ID"),
});
export type ProductIdInput = z.infer<typeof productIdSchema>;

export const productStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DELETED"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const mediaTypeSchema = z.enum(["IMAGE", "VIDEO"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

// Presigned upload request
export const uploadUrlRequestSchema = z.object({
  files: z
    .array(
      z.object({
        contentType: z.string().trim().min(1),
        size: z.number().int().positive(),
      }),
    )
    .min(1, "At least one file is required")
    .max(MAX_FILES, `Maximum ${MAX_FILES} files are allowed`),
});
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

// Create product
export const createProductSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, "SKU is required")
      .max(100, "SKU cannot exceed 100 characters"),

    name: z
      .string()
      .trim()
      .min(3, "Product name must be at least 3 characters")
      .max(200, "Product name cannot exceed 200 characters"),

    altName: altNameField.default([]),

    description: optionalText(1000, "Description"),

    stock: z
      .number({ message: "Stock must be a number" })
      .int("Stock must be an integer")
      .min(0, "Stock cannot be negative")
      .max(1_000_000, "Stock cannot exceed 1,000,000")
      .default(0),

    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),

    price: priceField.refine((v) => v > 0, "Price must be greater than 0"),

    compareAtPrice: priceField.nullish().transform((v) => v ?? null),

    brand: optionalText(100, "Brand"),
    model: optionalText(100, "Model"),

    // Keys of files already uploaded to S3 (in display order)
    media: z
      .array(
        z.object({
          key: z.string().regex(MEDIA_KEY_REGEX, "Invalid media key"),
        }),
      )
      .max(MAX_FILES, `Cannot have more than ${MAX_FILES} media items`)
      .default([]),
  })
  .refine(
    (data) => data.compareAtPrice === null || data.compareAtPrice > data.price,
    {
      message: "Compare-at price must be greater than the selling price",
      path: ["compareAtPrice"],
    },
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Update product
export const updateProductSchema = z.object({
  sku: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(3).max(200).optional(),
  altName: altNameField.optional(),
  description: optionalText(1000, "Description").optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  status: productStatusSchema.optional(),
  price: priceField.optional(),
  compareAtPrice: priceField.nullable().optional(),
  brand: optionalText(100, "Brand").optional(),
  model: optionalText(100, "Model").optional(),
  media: z
    .array(
      z.object({
        key: z.string().regex(MEDIA_KEY_REGEX, "Invalid media key"),
      }),
    )
    .max(MAX_FILES)
    .optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;