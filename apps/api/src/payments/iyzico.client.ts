import { createHmac, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Canlı adres; deneme için IYZICO_BASE_URL=https://sandbox-api.iyzipay.com */
export const IYZICO_LIVE_URL = 'https://api.iyzipay.com';

const INITIALIZE_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
const RETRIEVE_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail';
const TIMEOUT_MS = 20_000;

export interface CheckoutBuyer {
  id: string;
  name: string;
  surname: string;
  email: string;
  gsmNumber: string;
  city: string;
  address: string;
  ip: string;
}

export interface CheckoutRequest {
  /** Ödeme kaydımızın kimliği: conversationId ve basketId olarak gider, dönüşte karşılaştırılır */
  paymentId: string;
  /** TL, iki ondalıklı metin (ör. "1500.00") */
  price: string;
  itemName: string;
  callbackUrl: string;
  buyer: CheckoutBuyer;
}

/** iyzico'nun ortak yanıt alanları (yalnızca kullandıklarımız) */
interface IyzicoResponse {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
}

export interface CheckoutForm {
  token: string;
  paymentPageUrl: string;
  /** Saniye */
  tokenExpireTime: number;
}

export interface CheckoutResult {
  status: 'success' | 'failure';
  /** SUCCESS, FAILURE, INIT_THREEDS, CALLBACK_THREEDS... */
  paymentStatus?: string;
  paymentId?: string;
  price?: number | string;
  paidPrice?: number | string;
  currency?: string;
  basketId?: string;
  conversationId?: string;
  /** 1 onaylı, 0 incelemede, -1 reddedildi */
  fraudStatus?: number;
  errorCode?: string;
  errorMessage?: string;
}

export class IyzicoError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * iyzico Checkout Form (ortak ödeme sayfası). Kart bilgisi bize hiç gelmez.
 * Kimlik doğrulama IYZWSv2: HMAC-SHA256(gizli anahtar, rastgele anahtar + yol + gövde).
 * Ortam değişkenleri: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL (varsayılan canlı).
 */
@Injectable()
export class IyzicoClient {
  private readonly logger = new Logger(IyzicoClient.name);
  private readonly apiKey?: string;
  private readonly secretKey?: string;
  readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('IYZICO_API_KEY')?.trim() || undefined;
    this.secretKey = config.get<string>('IYZICO_SECRET_KEY')?.trim() || undefined;
    this.baseUrl = (config.get<string>('IYZICO_BASE_URL')?.trim() || IYZICO_LIVE_URL).replace(/\/$/, '');
  }

  /** Anahtarlar tanımlı mı (değilse kartla ödeme hiç görünmez) */
  get configured() {
    return Boolean(this.apiKey && this.secretKey);
  }

  /** Deneme ortamı: alınan ödeme gerçek para değildir */
  get sandbox() {
    return this.baseUrl.includes('sandbox');
  }

  async initializeCheckout(r: CheckoutRequest): Promise<CheckoutForm> {
    const res = await this.post<IyzicoResponse & Partial<CheckoutForm>>(INITIALIZE_PATH, {
      locale: 'tr',
      conversationId: r.paymentId,
      price: r.price,
      paidPrice: r.price,
      currency: 'TRY',
      basketId: r.paymentId,
      paymentGroup: 'PRODUCT',
      callbackUrl: r.callbackUrl,
      // Kredi yüklemesinde taksit yok
      enabledInstallments: [1],
      buyer: {
        id: r.buyer.id,
        name: r.buyer.name,
        surname: r.buyer.surname,
        gsmNumber: r.buyer.gsmNumber,
        email: r.buyer.email,
        // Firma alıcıda T.C. kimlik no istenmiyor; iyzico'nun önerdiği yer tutucu
        identityNumber: '11111111111',
        registrationAddress: r.buyer.address,
        ip: r.buyer.ip,
        city: r.buyer.city,
        country: 'Turkey',
      },
      billingAddress: { contactName: `${r.buyer.name} ${r.buyer.surname}`, city: r.buyer.city, country: 'Turkey', address: r.buyer.address },
      basketItems: [{ id: 'KREDI', name: r.itemName, category1: 'Kredi', itemType: 'VIRTUAL', price: r.price }],
    });
    if (res.status !== 'success' || !res.token || !res.paymentPageUrl) {
      throw new IyzicoError(res.errorMessage || 'Ödeme formu açılamadı', res.errorCode);
    }
    return { token: res.token, paymentPageUrl: res.paymentPageUrl, tokenExpireTime: res.tokenExpireTime ?? 1800 };
  }

  /** Ödemenin sonucu, iyzico'ya sunucudan sorularak (dönüş isteğindeki bilgiye güvenilmez) */
  retrieveCheckout(token: string, paymentId: string): Promise<CheckoutResult> {
    return this.post<CheckoutResult>(RETRIEVE_PATH, { locale: 'tr', conversationId: paymentId, token });
  }

  private async post<T>(path: string, body: object): Promise<T> {
    if (!this.apiKey || !this.secretKey) throw new IyzicoError('iyzico anahtarları tanımlı değil');
    const json = JSON.stringify(body);
    const randomKey = `${Date.now()}${randomBytes(4).toString('hex')}`;
    const signature = createHmac('sha256', this.secretKey).update(randomKey + path + json).digest('hex');
    const authorization = Buffer.from(`apiKey:${this.apiKey}&randomKey:${randomKey}&signature:${signature}`).toString('base64');
    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `IYZWSv2 ${authorization}`, 'x-iyzi-rnd': randomKey },
        body: json,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      this.logger.warn(`iyzico isteği başarısız (${path}): ${(e as Error).message}`);
      throw new IyzicoError('Ödeme sağlayıcısına ulaşılamadı');
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.warn(`iyzico yanıtı okunamadı (${path}, HTTP ${res.status})`);
      throw new IyzicoError('Ödeme sağlayıcısından beklenmeyen yanıt');
    }
  }
}
