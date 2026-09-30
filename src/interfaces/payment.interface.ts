import type { PaypackParams } from 'paypack-js';

export type PaymentStatusType = 'PENDING' | 'PAID' | 'SUCCESSFUL' | 'FAILED' | 'CANCELLED';
export type PaymentMethodType = 'MOMO' | 'CARD' | 'CASH_ON_DELIVERY';

export interface PaypackCashinParams extends PaypackParams {
  environment: 'development' | 'production';
}

export interface InitiatePaymentDTO {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethodType;
  phoneNumber?: string;
}

export interface UpdatePaymentStatusDTO {
  status: PaymentStatusType;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  data: {
    paymentId: string;
    orderId: string;
    amount: number;
    paymentMethod: PaymentMethodType;
    status: PaymentStatusType;
    ref?: string | null;
  };
}

export interface PaypackError {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}