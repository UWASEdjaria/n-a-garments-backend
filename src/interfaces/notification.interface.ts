export type AdminNotificationType =
  | 'NEW_USER'
  | 'ORDER_RECEIVED'
  | 'CUSTOM_ORDER_RECEIVED'
  | 'CONTACT_MESSAGE_RECEIVED'
  | 'CART_ACTIVITY'
  | 'SYSTEM';

export interface AdminNotificationData {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminNotificationListResponse {
  success: boolean;
  message: string;
  data: AdminNotificationData[];
}

export interface AdminNotificationSingleResponse {
  success: boolean;
  message: string;
  data: AdminNotificationData;
}

export interface AdminNotificationCountResponse {
  success: boolean;
  message: string;
  data: {
    count: number;
  };
}
