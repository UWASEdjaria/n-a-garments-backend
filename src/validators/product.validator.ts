import { z } from 'zod';

export const ALLOWED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const ALLOWED_COLORS = ['Black', 'White', 'Navy', 'Grey', 'Brown', 'Beige', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Orange', 'Purple'] as const;

const sizeEnum = z.enum(ALLOWED_SIZES, { error: `Size must be one of: ${ALLOWED_SIZES.join(', ')}` });
const colorEnum = z.enum(ALLOWED_COLORS, { error: `Color must be one of: ${ALLOWED_COLORS.join(', ')}` });

export const createProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters'),
  slug: z.string().min(3, 'Slug is required'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  price: z.number().positive('Price must be greater than 0'),
  stockQuantity: z.number().int().min(0).optional().default(0),
  minimumStockLevel: z.number().int().min(0).optional().default(5),
  sizes: z.array(sizeEnum).optional().default([]),
  colors: z.array(colorEnum).optional().default([]),
  categoryId: z.string().min(1, 'Category ID is required'),
});
