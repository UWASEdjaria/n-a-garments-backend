import { AppError } from '../utils/appError.js';
import { getExchangeRates } from './currency.service.js';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PayPalOrderResult {
  orderId: string;
  checkoutUrl: string;
  amount: string;
}

export interface PayPalCaptureResult {
  orderId: string;
  status: 'COMPLETED' | 'DECLINED' | 'PENDING';
  amount?: number;
}

export interface PayPalWebhookPayload {
  event_type: string;
  id: string;
  resource: {
    id: string;
    status?: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: {
      related_ids?: { order_id?: string };
    };
  };
}

export interface PayPalWebhookHeaders {
  transmissionId?: string;
  transmissionTime?: string;
  certUrl?: string;
  authAlgo?: string;
  transmissionSig?: string;
}

export class PayPalRequestError extends AppError {
  constructor(
    message: string,
    public readonly definitivelyRejected: boolean
  ) {
    super(message, definitivelyRejected ? 400 : 503);
  }
}

export class PayPalService {
  private getConfig(): PayPalConfig {
    const {
      PAYPAL_CLIENT_ID,
      PAYPAL_CLIENT_SECRET,
      PAYPAL_RETURN_URL,
      PAYPAL_CANCEL_URL,
    } = process.env;

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_RETURN_URL || !PAYPAL_CANCEL_URL) {
      throw new AppError(
        'PayPal is not configured. Required server environment variables are missing.',
        503
      );
    }

    const isSandbox = process.env.PAYPAL_MODE !== 'live';

    return {
      clientId: PAYPAL_CLIENT_ID,
      clientSecret: PAYPAL_CLIENT_SECRET,
      baseUrl: isSandbox
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com',
      returnUrl: PAYPAL_RETURN_URL,
      cancelUrl: PAYPAL_CANCEL_URL,
    };
  }

  private async getAccessToken(config: PayPalConfig): Promise<string> {
    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new PayPalRequestError('PayPal could not be reached.', false);
    }

    if (!response.ok) {
      throw new PayPalRequestError(`PayPal auth failed with HTTP ${response.status}.`, false);
    }

    let data: { access_token?: string } | null;

    try {
      data = (await response.json()) as { access_token?: string } | null;
    } catch {
      throw new PayPalRequestError('PayPal returned an invalid authentication response.', false);
    }

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      typeof data.access_token !== 'string' ||
      data.access_token.trim().length === 0
    ) {
      throw new PayPalRequestError('PayPal did not return an access token.', false);
    }

    return data.access_token;
  }

  public async createOrder(input: {
    refid: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<PayPalOrderResult> {
    if (input.currency !== 'USD') {
      throw new AppError('PayPal orders must use USD.', 400);
    }
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new AppError('PayPal requires a positive whole-number RWF amount.', 400);
    }

    const rates = await getExchangeRates();

    if (rates.source !== 'live') {
      throw new AppError('Live RWF-to-USD exchange rates are unavailable.', 503);
    }

    const usdRate = rates.rates.USD;

    if (typeof usdRate !== 'number' || !Number.isFinite(usdRate) || usdRate <= 0) {
      throw new AppError('A valid RWF-to-USD exchange rate is unavailable.', 503);
    }

    const usdAmount = Math.round(input.amount * usdRate * 100) / 100;

    if (!Number.isFinite(usdAmount) || usdAmount < 0.01) {
      throw new AppError('PayPal requires an order amount of at least USD 0.01.', 400);
    }

    const formattedAmount = usdAmount.toFixed(2);
    const config = this.getConfig();
    const token = await this.getAccessToken(config);

    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'PayPal-Request-Id': input.refid,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: input.refid,
              description: input.description,
              amount: {
                currency_code: 'USD',
                value: formattedAmount,
              },
            },
          ],
          application_context: {
            return_url: config.returnUrl,
            cancel_url: config.cancelUrl,
            brand_name: 'NA Garments',
            user_action: 'PAY_NOW',
          },
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new PayPalRequestError(
        'PayPal could not be reached. Check payment status before retrying.',
        false
      );
    }

    if (!response.ok) {
      const rejected = response.status >= 400 && response.status < 500;
      let message = `PayPal order creation failed with HTTP ${response.status}.`;
      if (response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429) {
        message = 'PayPal order creation outcome is uncertain. Check payment status before retrying.';
      }

      throw new PayPalRequestError(
        message,
        rejected &&
          response.status !== 401 &&
          response.status !== 403 &&
          response.status !== 408 &&
          response.status !== 409 &&
          response.status !== 425 &&
          response.status !== 429
      );
    }

    let data: {
      id?: string;
      links?: Array<{ rel: string; href: string }>;
    } | null;

    try {
      data = (await response.json()) as {
        id?: string;
        links?: Array<{ rel: string; href: string }>;
      } | null;
    } catch {
      throw new PayPalRequestError('PayPal returned an invalid order response.', false);
    }

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      typeof data.id !== 'string' ||
      data.id.trim().length === 0 ||
      !Array.isArray(data.links)
    ) {
      throw new PayPalRequestError('PayPal did not confirm order creation.', false);
    }

    const approveLink = data.links.find((link) => link?.rel === 'approve');

    if (typeof approveLink?.href !== 'string' || approveLink.href.trim().length === 0) {
      throw new PayPalRequestError('PayPal did not return an approval URL.', false);
    }

    let checkoutUrl: URL;

    try {
      checkoutUrl = new URL(approveLink.href);
    } catch {
      throw new PayPalRequestError('PayPal returned an invalid checkout URL.', false);
    }

    if (
      checkoutUrl.protocol !== 'https:' ||
      (checkoutUrl.hostname !== 'paypal.com' && !checkoutUrl.hostname.endsWith('.paypal.com'))
    ) {
      throw new PayPalRequestError('PayPal returned an untrusted checkout URL.', false);
    }

    return {
      orderId: data.id,
      checkoutUrl: checkoutUrl.toString(),
      amount: formattedAmount,
    };
  }

  public async captureOrder(paypalOrderId: string): Promise<PayPalCaptureResult> {
    if (!paypalOrderId.trim() || paypalOrderId !== paypalOrderId.trim()) {
      throw new AppError('A valid PayPal order ID is required for capture.', 400);
    }

    const config = this.getConfig();
    const token = await this.getAccessToken(config);

    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PayPal-Request-Id': paypalOrderId,
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new PayPalRequestError('PayPal could not be reached during capture.', false);
    }

    if (!response.ok) {
      const rejected = response.status >= 400 && response.status < 500;
      const uncertain =
        response.status === 408 ||
        response.status === 409 ||
        response.status === 425 ||
        response.status === 429;
      throw new PayPalRequestError(
        uncertain
          ? 'PayPal capture outcome is uncertain. Check payment status before retrying.'
          : `PayPal capture failed with HTTP ${response.status}.`,
        rejected && !uncertain
      );
    }

    let data: {
      id?: string;
      status?: string;
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id?: string;
            amount?: { value?: string; currency_code?: string };
            status?: string;
          }>;
        } | null;
      }>;
    } | null;

    try {
      data = (await response.json()) as {
        id?: string;
        status?: string;
        purchase_units?: Array<{
          payments?: {
            captures?: Array<{
              id?: string;
              amount?: { value?: string; currency_code?: string };
              status?: string;
            }>;
          } | null;
        }>;
      };
    } catch {
      throw new PayPalRequestError('PayPal returned an invalid capture response.', false);
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new PayPalRequestError('PayPal returned an incomplete capture response.', false);
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const rawStatus = capture?.status;
    const amountValue = capture?.amount?.value;

    if (
      data.id !== paypalOrderId ||
      typeof capture?.id !== 'string' ||
      capture.id.trim().length === 0 ||
      typeof rawStatus !== 'string' ||
      typeof amountValue !== 'string' ||
      !/^\d+(?:\.\d{1,2})?$/.test(amountValue) ||
      capture.amount?.currency_code !== 'USD'
    ) {
      throw new PayPalRequestError('PayPal returned an incomplete capture response.', false);
    }

    const parsedAmount = Number(amountValue);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new PayPalRequestError('PayPal returned an invalid capture amount.', false);
    }

    let status: PayPalCaptureResult['status'];

    if (rawStatus === 'COMPLETED') {
      status = 'COMPLETED';
    } else if (['DECLINED', 'FAILED', 'VOIDED'].includes(rawStatus)) {
      status = 'DECLINED';
    } else if (['PENDING', 'PAYER_ACTION_REQUIRED'].includes(rawStatus)) {
      status = 'PENDING';
    } else {
      throw new PayPalRequestError('PayPal returned an unsupported capture status.', false);
    }

    return {
      orderId: data.id,
      status,
      amount: Math.round(parsedAmount * 100),
    };
  }

  public async verifyWebhookSignature(
    rawBody: Buffer,
    payload: PayPalWebhookPayload,
    headers: PayPalWebhookHeaders
  ): Promise<boolean> {
    void rawBody;

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId?.trim()) {
      throw new AppError('PayPal webhook verification is not configured.', 503);
    }

    if (
      !headers.transmissionId?.trim() ||
      !headers.transmissionTime?.trim() ||
      !headers.certUrl?.trim() ||
      !headers.authAlgo?.trim() ||
      !headers.transmissionSig?.trim()
    ) {
      return false;
    }

    const config = this.getConfig();
    const token = await this.getAccessToken(config);
    let response: Response;

    try {
      response = await fetch(
        `${config.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            transmission_id: headers.transmissionId,
            transmission_time: headers.transmissionTime,
            cert_url: headers.certUrl,
            auth_algo: headers.authAlgo,
            transmission_sig: headers.transmissionSig,
            webhook_id: webhookId,
            webhook_event: payload,
          }),
          signal: AbortSignal.timeout(15000),
        }
      );
    } catch {
      throw new AppError(
        'Unable to verify the PayPal webhook because the verification service is unavailable.',
        503
      );
    }

    if (!response.ok) {
      throw new AppError('PayPal webhook verification service is unavailable.', 503);
    }

    let result: { verification_status?: string } | null;

    try {
      result = (await response.json()) as { verification_status?: string } | null;
    } catch {
      throw new AppError('PayPal returned an invalid webhook verification response.', 503);
    }

    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new AppError('PayPal returned an unusable webhook verification response.', 503);
    }

    if (result.verification_status === 'SUCCESS') {
      return true;
    }

    if (result.verification_status === 'FAILURE') {
      return false;
    }

    throw new AppError('PayPal returned an unusable webhook verification response.', 503);
  }
  public parseWebhookPayload(payload: object): PayPalWebhookPayload {
    if (typeof payload !== 'object' || payload === null) {
      throw new AppError('Invalid PayPal webhook payload.', 400);
    }

    const candidate = payload as Partial<PayPalWebhookPayload>;

    if (
      typeof candidate.event_type !== 'string' ||
      candidate.event_type.trim().length === 0 ||
      typeof candidate.id !== 'string' ||
      candidate.id.trim().length === 0 ||
      typeof candidate.resource !== 'object' ||
      candidate.resource === null ||
      typeof candidate.resource.id !== 'string' ||
      candidate.resource.id.trim().length === 0 ||
      (candidate.resource.status !== undefined &&
        typeof candidate.resource.status !== 'string') ||
      (candidate.resource.amount !== undefined &&
        (typeof candidate.resource.amount !== 'object' ||
          candidate.resource.amount === null ||
          (candidate.resource.amount.value !== undefined &&
            typeof candidate.resource.amount.value !== 'string') ||
          (candidate.resource.amount.currency_code !== undefined &&
            typeof candidate.resource.amount.currency_code !== 'string'))) ||
      (candidate.resource.supplementary_data !== undefined &&
        (typeof candidate.resource.supplementary_data !== 'object' ||
          candidate.resource.supplementary_data === null ||
          (candidate.resource.supplementary_data.related_ids !== undefined &&
            (typeof candidate.resource.supplementary_data.related_ids !== 'object' ||
              candidate.resource.supplementary_data.related_ids === null ||
              (candidate.resource.supplementary_data.related_ids.order_id !== undefined &&
                typeof candidate.resource.supplementary_data.related_ids.order_id !== 'string')))))
    ) {
      throw new AppError('Invalid PayPal webhook payload.', 400);
    }

    return candidate as PayPalWebhookPayload;
  }
}
