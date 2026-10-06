import { z } from 'zod';

export const createContactMessageSchema = z.object({
  names: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('A valid email address is required'),
  phone: z.string().trim().min(1, 'Phone cannot be empty').optional(),
  subject: z.string().trim().min(1, 'Subject cannot be empty').optional(),
  message: z.string().trim().min(1, 'Message is required'),
});

export const updateContactMessageReadSchema = z.object({
  isRead: z.boolean(),
});