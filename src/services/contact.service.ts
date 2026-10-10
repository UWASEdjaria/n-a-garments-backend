import { PrismaClient } from '@prisma/client';
import {
  ContactMessageResponse,
  CreateContactMessageRequest,
} from '../interfaces/contact.interface';
import { AppError } from '../utils/appError';

const prisma = new PrismaClient();

export class ContactService {
  async createMessage(
    body: CreateContactMessageRequest
  ): Promise<ContactMessageResponse> {
    const names = body.names?.trim();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim();
    const subject = body.subject?.trim();
    const message = body.message?.trim();

    if (!names || names.length < 2 || names.length > 120) {
      throw new AppError('Full name must be between 2 and 120 characters.', 400);
    }

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Please provide a valid email address.', 400);
    }

    if (phone && phone.length > 40) {
      throw new AppError('Phone number must be 40 characters or fewer.', 400);
    }

    if (!subject || subject.length > 160) {
      throw new AppError('Subject is required and must be 160 characters or fewer.', 400);
    }

    if (!message || message.length > 5000) {
      throw new AppError('Message is required and must be 5000 characters or fewer.', 400);
    }

    await prisma.contactMessage.create({
      data: {
        names,
        email,
        phone: phone || null,
        subject,
        message,
      },
    });

    return {
      success: true,
      message: 'Your message has been received.',
    };
  }
}