import {z} from 'zod';

export const productIdSchema = z.object(
    {
        id: z.string()
            .trim()
            .uuid('Invalid product ID')
    }
)

export type ProductIdInput = z.infer<typeof productIdSchema>;

export const productStatusSchema = z.enum(
    [
        'ACTIVE',
        'INACTIVE',
        'DELETED'
    ]
)

export type ProductStatus = z.infer<typeof productStatusSchema>;

export const mediaTypeSchema = z.enum(
    [
        'IMAGE',
        'VIDEO'
    ]
)

export type MediaType = z.infer<typeof mediaTypeSchema>;

export const productMediaSchema = z.object(
    {
        url: z
            .string()
            .trim()
            .url('Media URL must be a valid URL'),

        type: mediaTypeSchema,

    }
)

export type ProductMedia = z.infer<typeof productMediaSchema>;

export const createProductSchema = z.object(
    {
        sku: z
            .string()
            .trim()
            .min(1, 'SKU is required')
            .max(100, 'SKU cannot exceed 100 characters'),

        name: z
            .string()
            .trim()
            .min(10, 'Product name is required')
            .max(200, 'Product name cannot exceed 200 characters'),

        altName: z
            .array(
                z
                .string()
                .trim()
                .min(1, 'Alternative name cannot be empty')
                .max(200, 'Alternative name cannot exceed 200 characters')
            )
            .max(10, 'Cannot have more than 10 alternative names')
            .default([]),

        description: z
            .string()
            .trim()
            .min(10, 'Product description is required')
            .max(1000, 'Product description cannot exceed 1000 characters')
            .default(''),

        stock: z
            .number()
            .int('Stock must be an integer')
            .min(0, 'Stock cannot be negative')
            .max(1000000, 'Stock cannot exceed 1,000,000')
            .default(0),

        status: productStatusSchema.default('ACTIVE'),

        price: z
            .number()
            .finite('Price must be a float')
            .min(0, 'Price cannot be negative')
            .nonnegative('Price cannot be negative')
            .max(1000000, 'Price cannot exceed 1,000,000')
            .default(0),

        compareAtPrice: z
            .number()
            .finite('Compare at price must be a float')
            .min(0, 'Compare at price cannot be negative')
            .nonnegative('Compare at price cannot be negative')
            .max(1000000, 'Compare at price cannot exceed 1,000,000')
            .default(0)
            .nullable()
            .optional(),

        brand: z
            .string()
            .trim()
            .min(1, 'Brand is required')
            .max(100, 'Brand cannot exceed 100 characters')
            .default('')
            .optional(),

        model: z
            .string()
            .trim()
            .min(1, 'Model is required')
            .max(100, 'Model cannot exceed 100 characters')
            .default('')
            .optional(),

        media: z
            .array(productMediaSchema)
            .max(10, 'Cannot have more than 10 media items')
            .default([]),
            

    }
)

export type CreateProductInput = z.infer<typeof createProductSchema>;