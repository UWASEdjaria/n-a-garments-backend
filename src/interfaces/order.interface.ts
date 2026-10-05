export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface OrderItemData {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  purchasePrice: number;
  size: string | null;
  color: string | null;
}

export interface OrderData {
  id: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingAddr: string;
  items: OrderItemData[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceOrderRequest {
  shippingAddr: string;
}

export interface GuestPlaceOrderRequest {
  name: string;
  email: string;
  phone?: string;
  shippingAddr: string;
  items: {
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
  }[];
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface OrderResponse {
  success: boolean;
  message: string;
  data: OrderData;
}

export interface OrderListResponse {
  success: boolean;
  message: string;
  data: OrderData[];
  totalPages: number;
}
