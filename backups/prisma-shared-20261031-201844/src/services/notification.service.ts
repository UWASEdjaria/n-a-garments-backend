import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/appError.js';
import {
  AdminNotificationCountResponse,
  AdminNotificationListResponse,
  AdminNotificationSingleResponse,
  AdminNotificationType,
} from '../interfaces/notification.interface.js';

const prisma = new PrismaClient();

export interface CreateAdminNotificationInput {
  type: AdminNotificationType;
  title: string;
  message: string;
  resourceType?: string | null;
  resourceId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
}

export class NotificationService {
  async createNotification(
    input: CreateAdminNotificationInput,
  ): Promise<NonNullable<AdminNotificationListResponse['data'][number]>> {
    if (!input.title?.trim()) {
      throw new AppError('Notification title is required.', 400);
    }

    if (!input.message?.trim()) {
      throw new AppError('Notification message is required.', 400);
    }

    return prisma.adminNotification.create({
      data: {
        type: input.type,
        title: input.title.trim(),
        message: input.message.trim(),
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        actorName: input.actorName ?? null,
        actorEmail: input.actorEmail ?? null,
      },
    });
  }

  async getAllNotifications(): Promise<AdminNotificationListResponse> {
    const notifications = await prisma.adminNotification.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Admin notifications retrieved successfully',
      data: notifications,
    };
  }

  async getUnreadCount(): Promise<AdminNotificationCountResponse> {
    const count = await prisma.adminNotification.count({
      where: { isRead: false },
    });

    return {
      success: true,
      message: 'Unread notifications count retrieved successfully',
      data: { count },
    };
  }

  async markAsRead(id: string): Promise<AdminNotificationSingleResponse> {
    const existing = await prisma.adminNotification.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('Admin notification not found.', 404);
    }

    const notification = await prisma.adminNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return {
      success: true,
      message: 'Notification marked as read',
      data: notification,
    };
  }

  async markAllAsRead(): Promise<AdminNotificationCountResponse> {
    const result = await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    return {
      success: true,
      message: `${result.count} notifications marked as read`,
      data: { count: result.count },
    };
  }
}
