export interface RetryPaymentState {
  status: string;
}

export const isRetryEligible = (
  payment: RetryPaymentState
): boolean =>
  payment.status === 'FAILED' || payment.status === 'CANCELLED';
