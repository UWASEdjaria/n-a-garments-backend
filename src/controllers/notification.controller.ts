import { Controller, Get, Patch, Path, Route, Security, Tags, Response } from 'tsoa';
import {
  AdminNotificationCountResponse,
  AdminNotificationListResponse,
  AdminNotificationSingleResponse,
} from '../interfaces/notification.interface.js';
import { StandardErrorResponse } from '../interfaces/auth.interface.js';
import { NotificationService } from '../services/notification.service.js';

@Route('admin/notifications')
@Tags('Admin Notifications')
@Security('jwt', ['ADMIN'])
export class NotificationController extends Controller {
  private notificationService = new NotificationService();

  @Get()
  @Response<StandardErrorResponse>(401, 'Unauthorized')
  public async getAllNotifications(): Promise<AdminNotificationListResponse> {
    return this.notificationService.getAllNotifications();
  }

  @Get('unread-count')
  @Response<StandardErrorResponse>(401, 'Unauthorized')
  public async getUnreadCount(): Promise<AdminNotificationCountResponse> {
    return this.notificationService.getUnreadCount();
  }

  @Patch('{id}/read')
  @Response<StandardErrorResponse>(401, 'Unauthorized')
  @Response<StandardErrorResponse>(404, 'Admin notification not found')
  public async markAsRead(@Path() id: string): Promise<AdminNotificationSingleResponse> {
    return this.notificationService.markAsRead(id);
  }

  @Patch('mark-all-read')
  @Response<StandardErrorResponse>(401, 'Unauthorized')
  public async markAllAsRead(): Promise<AdminNotificationCountResponse> {
    return this.notificationService.markAllAsRead();
  }
}
