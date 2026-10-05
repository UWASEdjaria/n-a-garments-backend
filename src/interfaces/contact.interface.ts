export interface CreateContactMessageRequest {
  names: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export interface UpdateContactMessageReadRequest {
  isRead: boolean;
}

export interface ContactMessageData {
  id: string;
  names: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface ContactMessageSingleResponse {
  success: boolean;
  message: string;
  data: ContactMessageData;
}

export interface ContactMessageListResponse {
  success: boolean;
  message: string;
  data: ContactMessageData[];
}

export interface ContactMessageDeleteResponse {
  success: boolean;
  message: string;
}