import { OrderStatus, PaymentStatus } from './order.interface.js';

export interface CreateCustomOrderRequest {
  name: string;
  email: string;
  phone: string;
  garmentType: string;
  quantity: number;
  measurements?: string;
  description: string;
  additionalReqs?: string;
  referenceImageUrls?: string[];
}

export interface CustomOrderData {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  garmentType: string;
  quantity: number;
  measurements: string | null;
  description: string;
  additionalReqs: string | null;
  referenceImageUrls: string[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCustomOrderStatusRequest {
  status: OrderStatus;
  adminNotes?: string;
}

export interface CustomOrderResponse {
  success: boolean;
  message: string;
  data: CustomOrderData;
}

export interface CustomOrderListResponse {
  success: boolean;
  message: string;
  data: CustomOrderData[];
  totalPages: number;
}