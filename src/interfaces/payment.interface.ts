
export type PaymentStatusType = 'PENDING' | 'PAID' | 'SUCCESSFUL' | 'FAILED' | 'CANCELLED';
export type PaymentMethodType = 'MOMO' | 'CARD' | 'CASH_ON_DELIVERY';
export type PaymentProviderType = 'PAYPACK' | 'PAYPAL';


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
    provider?: PaymentProviderType | null;
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
  provider?: PaymentProviderType | null;
  status: PaymentStatusType;
  ref: string;
  createdAt: string;
}




export interface InitiateCustomQuotePaymentDTO {
  phoneNumber: string;
}

export interface CustomQuotePaymentResponse {
  success: boolean;
  message: string;
  data: {
    paymentId: string;
    customOrderId: string;
    quoteReference: string | null;
    amount: number;
    paymentMethod: 'MOMO';
    provider: 'PAYPACK';
    status: PaymentStatusType;
    ref: string;
    quoteTotal: number;
    advanceAmount: number;
    advancePaidAmount: number;
    balanceAmount: number;
  };
}

export interface CustomQuotePaymentStatusResponse {
  success: boolean;
  message: string;
  data: {
    customOrderId: string;
    quoteReference: string | null;
    quoteStatus: 'PROPOSED' | 'ACCEPTED';
    paymentStatus: string;
    quoteTotal: number;
    advanceAmount: number;
    advancePaidAmount: number;
    balanceAmount: number;
    payments: Array<{
      paymentId: string;
      amount: number;
      status: PaymentStatusType;
      ref: string;
      createdAt: string;
    }>;
  };
}
