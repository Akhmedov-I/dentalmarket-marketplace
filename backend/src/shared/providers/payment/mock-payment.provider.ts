import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';

import {
  PaymentProvider,
  PaymentResult,
  RefundResult,
  PayoutResult,
} from './payment-provider.interface';

const MOCK_WEBHOOK_SECRET = 'mock_webhook_secret_test';

export class MockPaymentProvider implements PaymentProvider {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'MockPaymentProvider must NOT be used in production. ' +
          'Configure a real payment provider instead.',
      );
    }
    console.log('[MockPaymentProvider] Initialized (non-production mode)');
  }

  async capture(
    orderId: string,
    amount: bigint,
    currency: string,
    cardToken: string,
  ): Promise<PaymentResult> {
    const last4 = cardToken.slice(-4);
    console.log(
      `[MockPaymentProvider] capture() orderId=${orderId} amount=${amount} currency=${currency} last4=${last4}`,
    );

    switch (last4) {
      case '0002':
        console.log('[MockPaymentProvider] Card declined');
        return {
          success: false,
          providerPaymentId: `pay_${randomUUID()}`,
          status: 'failed',
          errorCode: 'card_declined',
          errorMessage: 'The card was declined by the issuing bank.',
        };

      case '0051': {
        const delayMs = 3000;
        console.log(
          `[MockPaymentProvider] Simulating slow processor (${delayMs}ms delay)`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return {
          success: true,
          providerPaymentId: `pay_${randomUUID()}`,
          status: 'captured',
        };
      }

      case '0044':
        console.log(
          '[MockPaymentProvider] Approved (dispute-scenario card)',
        );
        return {
          success: true,
          providerPaymentId: `pay_${randomUUID()}`,
          status: 'captured',
        };

      case '0000':
      default:
        console.log('[MockPaymentProvider] Approved');
        return {
          success: true,
          providerPaymentId: `pay_${randomUUID()}`,
          status: 'captured',
        };
    }
  }

  async refund(
    providerPaymentId: string,
    amount: bigint,
    currency: string,
  ): Promise<RefundResult> {
    console.log(
      `[MockPaymentProvider] refund() providerPaymentId=${providerPaymentId} amount=${amount} currency=${currency}`,
    );

    return {
      success: true,
      providerRefundId: `ref_${randomUUID()}`,
      status: 'completed',
    };
  }

  async payout(
    sellerId: string,
    amount: bigint,
    currency: string,
    payoutAccount: any,
  ): Promise<PayoutResult> {
    console.log(
      `[MockPaymentProvider] payout() sellerId=${sellerId} amount=${amount} currency=${currency} account=${JSON.stringify(payoutAccount)}`,
    );

    return {
      success: true,
      providerPayoutId: `po_${randomUUID()}`,
      status: 'scheduled',
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expected = createHmac('sha256', MOCK_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    const valid = expected === signature;
    console.log(
      `[MockPaymentProvider] verifyWebhookSignature() valid=${valid}`,
    );
    return valid;
  }
}
