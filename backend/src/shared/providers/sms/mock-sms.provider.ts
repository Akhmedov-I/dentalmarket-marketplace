import { randomUUID } from 'crypto';

import { SmsProvider, SmsResult } from './sms-provider.interface';

export interface StoredSmsMessage {
  phone: string;
  body: string;
  type: 'otp' | 'message';
  timestamp: Date;
  messageId: string;
}

export class MockSmsProvider implements SmsProvider {
  private readonly sentMessages: StoredSmsMessage[] = [];

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'MockSmsProvider must NOT be used in production. ' +
          'Configure a real SMS provider instead.',
      );
    }
    console.log('[MockSmsProvider] Initialized (non-production mode)');
  }

  async sendOtp(phone: string, code: string): Promise<SmsResult> {
    console.log(`[MockSmsProvider] OTP for ${phone}: ${code}`);

    const messageId = `sms_${randomUUID()}`;
    this.sentMessages.push({
      phone,
      body: code,
      type: 'otp',
      timestamp: new Date(),
      messageId,
    });

    return { success: true, messageId };
  }

  async sendMessage(phone: string, message: string): Promise<SmsResult> {
    console.log(`[MockSmsProvider] Message to ${phone}: ${message}`);

    const messageId = `sms_${randomUUID()}`;
    this.sentMessages.push({
      phone,
      body: message,
      type: 'message',
      timestamp: new Date(),
      messageId,
    });

    return { success: true, messageId };
  }

  /** Retrieve all sent messages — useful for test assertions. */
  getSentMessages(): ReadonlyArray<StoredSmsMessage> {
    return [...this.sentMessages];
  }
}
