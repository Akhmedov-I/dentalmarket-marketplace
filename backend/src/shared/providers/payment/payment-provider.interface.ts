export interface PaymentResult {
  success: boolean;
  providerPaymentId: string;
  status: 'captured' | 'failed' | 'authorized';
  errorCode?: string;
  errorMessage?: string;
}

export interface RefundResult {
  success: boolean;
  providerRefundId: string;
  status: 'completed' | 'failed';
}

export interface PayoutResult {
  success: boolean;
  providerPayoutId: string;
  status: 'scheduled' | 'failed';
}

export interface PaymentProvider {
  capture(
    orderId: string,
    amount: bigint,
    currency: string,
    cardToken: string,
  ): Promise<PaymentResult>;

  refund(
    providerPaymentId: string,
    amount: bigint,
    currency: string,
  ): Promise<RefundResult>;

  payout(
    sellerId: string,
    amount: bigint,
    currency: string,
    payoutAccount: any,
  ): Promise<PayoutResult>;

  verifyWebhookSignature(payload: string, signature: string): boolean;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
