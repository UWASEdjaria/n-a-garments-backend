import { OrderStatus, PaymentStatus } from './order.interface.js';

export type QuoteStatus = 'PENDING' | 'PROPOSED' | 'ACCEPTED' | 'DECLINED';
export type ProductionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

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
  productId?: string;
}

export interface ProposeQuoteRequest {
  quoteTotal: number;
  advanceAmount: number;
  adminNotes?: string;
}

export interface AcceptQuoteRequest {
  accepted: boolean;
}

export interface CustomOrderData {
  id: string;
  userId: string | null;
  productId: string | null;
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
  quoteStatus: QuoteStatus;
  quoteTotal: number | null;
  advanceAmount: number | null;
  advancePaidAmount: number;
  balanceAmount: number | null;
  quoteProposedAt: Date | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  productionStatus: ProductionStatus;
  completedAt: Date | null;
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