import { z } from 'zod';

export const guestPlaceOrderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('A valid email address is required'),
  phone: z.string().trim().min(1, 'Phone cannot be empty').optional(),
  shippingAddr: z.string().trim().min(1, 'Shipping address is required'),
  items: z.array(z.object({
    productId: z.string().trim().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be greater than zero'),
    size: z.string().trim().min(1).optional(),
    color: z.string().trim().min(1).optional(),
  })).min(1, 'At least one cart item is required'),
});