import { Global, Module } from '@nestjs/common';

import { PAYMENT_PROVIDER } from './payment/payment-provider.interface';
import { MockPaymentProvider } from './payment/mock-payment.provider';
import { SMS_PROVIDER } from './sms/sms-provider.interface';
import { MockSmsProvider } from './sms/mock-sms.provider';
import { REGISTRY_VALIDATOR } from './registry/registry-validator.interface';
import { MockRegistryValidator } from './registry/mock-registry.validator';

@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      useClass: MockPaymentProvider,
    },
    {
      provide: SMS_PROVIDER,
      useClass: MockSmsProvider,
    },
    {
      provide: REGISTRY_VALIDATOR,
      useClass: MockRegistryValidator,
    },
  ],
  exports: [PAYMENT_PROVIDER, SMS_PROVIDER, REGISTRY_VALIDATOR],
})
export class ProvidersModule {}
