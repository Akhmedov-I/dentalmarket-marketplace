import { randomUUID } from 'crypto';

import {
  RegistryValidator,
  RegistryLookupResult,
} from './registry-validator.interface';

export class MockRegistryValidator implements RegistryValidator {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'MockRegistryValidator must NOT be used in production. ' +
          'Configure a real registry validator instead.',
      );
    }
    console.log('[MockRegistryValidator] Initialized (non-production mode)');
  }

  async validate(
    standardCode: string,
    certificateNumber: string,
    issuedBy: string,
  ): Promise<RegistryLookupResult> {
    console.log(
      `[MockRegistryValidator] validate() standardCode=${standardCode} cert=${certificateNumber} issuedBy=${issuedBy}`,
    );

    const matched = this.isMatch(certificateNumber);
    const lookupId = `reg_${randomUUID()}`;

    console.log(
      `[MockRegistryValidator] Result: matched=${matched} lookupId=${lookupId}`,
    );

    return {
      matched,
      registryName: `MockRegistry_${standardCode}`,
      lookupId,
      details: matched
        ? {
            standardCode,
            certificateNumber,
            issuedBy,
            verifiedAt: new Date().toISOString(),
          }
        : undefined,
    };
  }

  private isMatch(certificateNumber: string): boolean {
    const upper = certificateNumber.toUpperCase();

    if (upper.includes('VALID') && !upper.includes('INVALID')) {
      return true;
    }
    if (upper.includes('INVALID')) {
      return false;
    }

    // Fall back to last digit parity: even → match, odd → no match
    const lastChar = certificateNumber.slice(-1);
    const lastDigit = parseInt(lastChar, 10);

    if (!isNaN(lastDigit)) {
      return lastDigit % 2 === 0;
    }

    // Non-numeric trailing character → default to matched
    return true;
  }
}
