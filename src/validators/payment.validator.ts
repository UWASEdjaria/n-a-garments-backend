import { z } from 'zod';

export const initiatePaymentSchema = z
  .object({
    orderId: z.string().min(1, 'Order ID is required'),
    amount: z.number().int().positive('Amount must be a positive whole number of RWF'),
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

export const initiateGuestPaymentSchema = z
  .object({
    orderId: z.string().min(1, 'Order ID is required'),
    email: z.string().trim().email('A valid email address is required'),
    amount: z.number().int().positive('Amount must be a positive whole number of RWF'),
    paymentMethod: z.enum(['MOMO', 'CARD', 'CASH_ON_DELIVERY']),
    phoneNumber: z.string().optional(),
  })
  .refine(
    (data) => data.paymentMethod !== 'MOMO' || Boolean(data.phoneNumber?.trim()),
    { message: 'Phone number is required for Mobile Money payments', path: ['phoneNumber'] },
  );

export const updatePaymentStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'SUCCESSFUL', 'FAILED', 'CANCELLED']),
});


export const initiateCustomQuotePaymentSchema = z
  .object({
    phoneNumber: z
      .string()
      .trim()
      .min(1, 'Mobile Money phone number is required')
      .max(30, 'Phone number is too long')
      .refine((phone) => {
        const digits = phone.replace(/\D/g, '');
        return (
          /^07\d{8}$/.test(digits) ||
          /^7\d{8}$/.test(digits) ||
          /^2507\d{8}$/.test(digits)
        );
      }, 'A valid Rwanda Mobile Money phone number is required'),
  })
  .strict();
