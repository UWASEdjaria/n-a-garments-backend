import { AppError } from '../utils/appError.js';

interface KPayConfig {
  apiKey: string;
  username: string;
  password: string;
  retailerId: string;
  baseUrl: string;
  callbackUrl: string;
  redirectUrl: string;
}

interface KPayApiResponse {
  success?: number | string;
  reply?: string;
  retcode?: number | string;
  refid?: string;
  tid?: string;
  url?: string;
  statusid?: string;
  statusdesc?: string;
  momtransactionid?: string;
  amount?: number | string;
}

export interface KPayInitiationResult {
  refid: string;
  url: string;
  tid?: string;
  reply: string;
}

export interface KPayStatusResult {
  refid: string;
  statusid: '01' | '02' | '03';
  statusdesc?: string;
  tid?: string;
  momtransactionid?: string;
  amount?: number | string;
}

export class KPayRequestError extends AppError {
  constructor(
    message: string,
    public readonly definitivelyRejected: boolean
  ) {
    super(message, definitivelyRejected ? 400 : 503);
  }
}

export class KPayService {
  private getConfig(): KPayConfig {
    const {
      KPAY_API_KEY,
      KPAY_USERNAME,
      KPAY_PASSWORD,
      KPAY_RETAILER_ID,
      KPAY_CALLBACK_URL,
      KPAY_REDIRECT_URL,
    } = process.env;

    if (
      !KPAY_API_KEY ||
      !KPAY_USERNAME ||
      !KPAY_PASSWORD ||
      !KPAY_RETAILER_ID ||
      !KPAY_CALLBACK_URL ||
      !KPAY_REDIRECT_URL
    ) {
      throw new AppError(
        'K-Pay is not configured. Required server environment variables are missing.',
        503
      );
    }

    return {
      apiKey: KPAY_API_KEY,
      username: KPAY_USERNAME,
      password: KPAY_PASSWORD,
      retailerId: KPAY_RETAILER_ID,
      baseUrl: process.env.KPAY_BASE_URL || 'https://pay.esicia.com/',
      callbackUrl: KPAY_CALLBACK_URL,
      redirectUrl: KPAY_REDIRECT_URL,
    };
  }

  private async request(
    body: Record<string, string | number>
  ): Promise<KPayApiResponse> {
    const config = this.getConfig();
    const baseUrl = config.baseUrl.endsWith('/')
      ? config.baseUrl
      : `${config.baseUrl}/`;

    if (new URL(baseUrl).protocol !== 'https:') {
      throw new AppError('K-Pay API must use HTTPS.', 500);
    }

    let response: Response;

    try {
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Kpay-Key': config.apiKey,
          Authorization: `Basic ${Buffer.from(
            `${config.username}:${config.password}`
          ).toString('base64')}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new KPayRequestError(
        'K-Pay could not be reached. The payment outcome may be uncertain; check its status before retrying.',
        false
      );
    }

    let result: KPayApiResponse;

    try {
      result = (await response.json()) as KPayApiResponse;
    } catch {
      throw new KPayRequestError(
        'K-Pay returned an unreadable response. Check payment status before retrying.',
        false
      );
    }

    if (!response.ok) {
      const rejected = response.status >= 400 && response.status < 500;

      throw new KPayRequestError(
        typeof result.reply === 'string'
          ? result.reply
          : `K-Pay request failed with HTTP ${response.status}.`,
        rejected
      );
    }

    return result;
  }

  public async initiatePayment(input: {
    refid: string;
    phoneNumber: string;
    email: string;
    details: string;
    amount: number;
    customerName: string;
    customerNumber: string;
    paymentMethod: 'momo' | 'cc';
  }): Promise<KPayInitiationResult> {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new AppError('K-Pay requires a positive integer RWF amount.', 400);
    }

    const config = this.getConfig();

    const result = await this.request({
      action: 'pay',
      msisdn: input.phoneNumber.replace(/\D/g, ''),
      email: input.email,
      details: input.details,
      refid: input.refid,
      amount: input.amount,
      currency: 'RWF',
      cname: input.customerName,
      cnumber: input.customerNumber,
      pmethod: input.paymentMethod,
      retailerid: config.retailerId,
      returl: config.callbackUrl,
      redirecturl: config.redirectUrl,
    });

    if (
      String(result.success) !== '1' ||
      result.refid !== input.refid ||
      typeof result.url !== 'string'
    ) {
      throw new KPayRequestError(
        typeof result.reply === 'string'
          ? result.reply
          : 'K-Pay did not confirm payment initiation.',
        String(result.success) === '0'
      );
    }

    let checkoutUrl: URL;

    try {
      checkoutUrl = new URL(result.url);
    } catch {
      throw new KPayRequestError(
        'K-Pay returned an invalid checkout URL.',
        false
      );
    }

    if (
      checkoutUrl.protocol !== 'https:' ||
      checkoutUrl.hostname !== 'pay.esicia.com'
    ) {
      throw new KPayRequestError(
        'K-Pay returned an unexpected checkout host.',
        false
      );
    }

    return {
      refid: result.refid,
      url: checkoutUrl.toString(),
      ...(typeof result.tid === 'string' ? { tid: result.tid } : {}),
      reply: result.reply || 'PENDING',
    };
  }

  public async checkStatus(refid: string): Promise<KPayStatusResult> {
    if (!refid.trim()) {
      throw new AppError('K-Pay payment reference is required.', 400);
    }

    const result = await this.request({
      action: 'checkstatus',
      refid,
    });

    const statusid = result.statusid;

    if (
      result.refid !== refid ||
      !['01', '02', '03'].includes(String(statusid))
    ) {
      throw new AppError(
        'K-Pay returned an invalid or mismatched payment status.',
        503
      );
    }

    return {
      refid,
      statusid: statusid as '01' | '02' | '03',
      ...(typeof result.statusdesc === 'string'
        ? { statusdesc: result.statusdesc }
        : {}),
      ...(typeof result.tid === 'string' ? { tid: result.tid } : {}),
      ...(typeof result.momtransactionid === 'string'
        ? { momtransactionid: result.momtransactionid }
        : {}),
      ...(typeof result.amount === 'number' ||
      typeof result.amount === 'string'
        ? { amount: result.amount }
        : {}),
    };
  }
}
