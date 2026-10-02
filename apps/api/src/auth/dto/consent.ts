/** Kayıtta gelen yasal onaylar: koşulların kabul edildiği sürüm ve isteğe bağlı ticari ileti izni */
export interface ConsentInput {
  termsVersion?: string;
  marketingConsent?: boolean;
}

/** User kaydına yazılacak onay alanları (onay yoksa boş) */
export function consentData({ termsVersion, marketingConsent }: ConsentInput, now = new Date()) {
  return {
    ...(termsVersion && { termsAcceptedAt: now, termsVersion }),
    ...(marketingConsent && { marketingConsentAt: now }),
  };
}
