export interface SmsResult {
  success: boolean;
  messageId: string;
}

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<SmsResult>;
  sendMessage(phone: string, message: string): Promise<SmsResult>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';
