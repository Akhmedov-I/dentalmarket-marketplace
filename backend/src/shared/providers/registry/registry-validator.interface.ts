export interface RegistryLookupResult {
  matched: boolean;
  registryName: string;
  lookupId: string;
  details?: Record<string, any>;
}

export interface RegistryValidator {
  validate(
    standardCode: string,
    certificateNumber: string,
    issuedBy: string,
  ): Promise<RegistryLookupResult>;
}

export const REGISTRY_VALIDATOR = 'REGISTRY_VALIDATOR';
