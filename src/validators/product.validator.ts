import { z } from 'zod';

export const ALLOWED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const ALLOWED_COLORS = [
  'Black',
  'White',
  'Navy',
  'Navy Blue',
  'Grey',
  'Brown',
  'Beige',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Pink',
  'Orange',
  'Purple',
  'Sky Blue',
  'Charcoal Grey',
] as const;
export const ALLOWED_PRODUCT_TYPES = ['READY_TO_WEAR', 'MADE_TO_ORDER'] as const;

const sizeEnum = z.string().trim().min(1, 'Size cannot be empty');
const colorEnum = z.string().trim().min(1, 'Color cannot be empty');
const productTypeEnum = z.enum(ALLOWED_PRODUCT_TYPES, { error: `Product type must be READY_TO_WEAR or MADE_TO_ORDER` });

const productFields = {
  name: z.string().min(3, 'Product name must be at least 3 characters'),
  slug: z.string().min(3, 'Slug is required'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  price: z.number().positive('Price must be greater than 0').nullable().optional(),
  stockQuantity: z.number().int().refine((quantity) => quantity === 0, 'Record initial stock through Stock Management').optional().default(0),
  minimumStockLevel: z.number().int().min(0).optional().default(5),
  maximumStockLevel: z.number().int().min(0).optional().default(100),
  sizes: z.array(sizeEnum).optional().default([]),
  colors: z.array(colorEnum).optional().default([]),
  categoryId: z.string().min(1, 'Category ID is required'),
  isAvailable: z.boolean().optional().default(true),
  productType: productTypeEnum.optional().default('MADE_TO_ORDER'),
};

const validateStockThresholds = <T extends { minimumStockLevel?: number; maximumStockLevel?: number }>(
  value: T,
  context: z.RefinementCtx
) => {
  if (
    value.minimumStockLevel !== undefined &&
    value.maximumStockLevel !== undefined &&
    value.maximumStockLevel < value.minimumStockLevel
  ) {
    context.addIssue({
      code: 'custom',
      path: ['maximumStockLevel'],
      message: 'Maximum stock threshold must be greater than or equal to the minimum threshold',
    });
  }
};
const validateProductPrice = (
  value: {
    price?: number | null;
    productType?: (typeof ALLOWED_PRODUCT_TYPES)[number];
  },
  context: z.RefinementCtx
) => {
  if (
    value.productType === 'READY_TO_WEAR' &&
    (value.price == null || value.price <= 0)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['price'],
      message: 'Ready to Wear products must have a price greater than zero',
    });
  }
};

export const createProductSchema = z
  .object(productFields)
  .superRefine((value, context) => {
    validateStockThresholds(value, context);
    validateProductPrice(value, context);
  });

export const updateProductSchema = z
  .object({
    ...productFields,
    stockQuantity: z.number().int().min(0).optional(),
    minimumStockLevel: z.number().int().min(0).optional(),
    maximumStockLevel: z.number().int().min(0).optional(),
    sizes: z.array(sizeEnum).optional(),
    colors: z.array(colorEnum).optional(),
    isAvailable: z.boolean().optional(),
    productType: productTypeEnum.optional(),
  })
  .partial()
  .superRefine((value, context) => {
    validateStockThresholds(value, context);
    validateProductPrice(value, context);
  });