
export type PaymentStatusType = 'PENDING' | 'PAID' | 'SUCCESSFUL' | 'FAILED' | 'CANCELLED';
export type PaymentMethodType = 'MOMO' | 'CARD' | 'CASH_ON_DELIVERY';


export interface InitiatePaymentDTO {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethodType;
  phoneNumber?: string;
}

export interface InitiateGuestPaymentDTO extends InitiatePaymentDTO {
  email: string;
}

export interface UpdatePaymentStatusDTO {
  status: PaymentStatusType;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  data: {
    paymentId: string;
    checkoutUrl?: string;
    orderId: string;
    amount: number;
    paymentMethod: PaymentMethodType;
    status: PaymentStatusType;
    ref?: string | null;
    retryAvailable?: boolean;
    attempts?: PaymentAttemptSummary[];
  };
}

export interface PaymentAttemptSummary {
  paymentId: string;
  amount: number;
  paymentMethod: PaymentMethodType;
  status: PaymentStatusType;
  ref: string;
  createdAt: string;
}


