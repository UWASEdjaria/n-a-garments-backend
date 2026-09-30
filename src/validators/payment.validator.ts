import { z } from 'zod';

export const initiatePaymentSchema = z
  .object({
    orderId: z.string().min(1, 'Order ID is required'),
    amount: z.number().positive('Amount must be greater than zero'),
    paymentMethod: z.enum(['MOMO', 'CARD', 'CASH_ON_DELIVERY']),
    phoneNumber: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.paymentMethod === 'MOMO' && (!data.phoneNumber || data.phoneNumber.trim() === '')) {
        return false;
      }
      return true;
    },
    {
      message: 'Phone number is required for Mobile Money payments',
      path: ['phoneNumber'],
    }
  );

export const updatePaymentStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'SUCCESSFUL', 'FAILED', 'CANCELLED']),
});