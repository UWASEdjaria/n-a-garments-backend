import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(3, "Product name must be at least 3 characters"),
  slug: z.string().min(3, "Slug is required"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  price: z.number().positive("Price must be greater than 0"),
  stockQuantity: z.number().int().min(0).optional().default(0),
  minimumStockLevel: z.number().int().min(0).optional().default(5),
  sizes: z.array(z.string()).optional().default([]),
  colors: z.array(z.string()).optional().default([]),
  categoryId: z.string().min(1, "Category ID is required"),
  imageUrl: z.string().optional(),
});