import { PrismaClient } from '@prisma/client';
import {
  ContactMessageDeleteResponse,
  ContactMessageListResponse,
  ContactMessageSingleResponse,
  CreateContactMessageRequest,
  UpdateContactMessageReadRequest,
} from '../interfaces/contact.interface';
import { AppError } from '../utils/appError';

const prisma = new PrismaClient();

export class ContactService {
  async createMessage(body: CreateContactMessageRequest): Promise<ContactMessageSingleResponse> {
    const contactMessage = await prisma.contactMessage.create({
      data: {
        names: body.names,
        email: body.email,
        phone: body.phone ?? null,
        subject: body.subject ?? null,
        message: body.message,
      },
    });

    return {
      success: true,
      message: 'Contact message sent successfully',
      data: contactMessage,
    };
  }

  async getAllMessages(): Promise<ContactMessageListResponse> {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Contact messages retrieved successfully',
      data: messages,
    };
  }

  async getMessageById(id: string): Promise<ContactMessageSingleResponse> {
    const contactMessage = await prisma.contactMessage.findUnique({ where: { id } });

    if (!contactMessage) {
      throw new AppError('Contact message not found.', 404);
    }

    return {
      success: true,
      message: 'Contact message retrieved successfully',
      data: contactMessage,
    };
  }

  async updateMessageReadStatus(
    id: string,
    body: UpdateContactMessageReadRequest,
  ): Promise<ContactMessageSingleResponse> {
    const existingMessage = await prisma.contactMessage.findUnique({ where: { id } });

    if (!existingMessage) {
      throw new AppError('Contact message not found.', 404);
    }

    const contactMessage = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: body.isRead },
    });

    return {
      success: true,
      message: 'Contact message read status updated successfully',
      data: contactMessage,
    };
  }

  async deleteMessage(id: string): Promise<ContactMessageDeleteResponse> {
    const existingMessage = await prisma.contactMessage.findUnique({ where: { id } });

    if (!existingMessage) {
      throw new AppError('Contact message not found.', 404);
    }

    await prisma.contactMessage.delete({ where: { id } });

    return {
      success: true,
      message: 'Contact message deleted successfully',
    };
  }
}