export type PersonalDataClass = 'CUSTOMER_ID' | 'NATIONAL_ID' | 'ACCOUNT_HOLDER_NAME' | 'CONTACT';

export interface TokenizedValue {
  token: string;
  dataClass: PersonalDataClass;
  vaultKeyVersion: string;
}

export function assertTokenizedValue(value: TokenizedValue): void {
  if (!/^tok_[A-Za-z0-9_-]{16,128}$/.test(value.token)) throw new TypeError('Invalid vault token');
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(value.vaultKeyVersion)) throw new TypeError('Invalid vault key version');
}

export function assertPurpose(purpose: string): void {
  if (!/^[A-Z][A-Z0-9_]{4,63}$/.test(purpose)) throw new TypeError('Detokenization purpose is required and must be explicit');
}
