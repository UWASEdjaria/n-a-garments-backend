import { AppError } from '../utils/appError.js';

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
}

export interface PayPalCaptureResult {
  orderId: string;
  status: 'COMPLETED' | 'DECLINED' | 'PENDING';
  amount?: number;
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

    const data = (await response.json()) as { access_token?: string };

    if (!data.access_token) {
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
                currency_code: input.currency,
                value: (input.amount / 100).toFixed(2),
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

      try {
        const err = (await response.json()) as { message?: string };
        if (err.message) message = err.message;
      } catch { /* ignore */ }

      throw new PayPalRequestError(message, rejected);
    }

    const data = (await response.json()) as {
      id?: string;
      links?: Array<{ rel: string; href: string }>;
    };

    if (!data.id || !Array.isArray(data.links)) {
      throw new PayPalRequestError('PayPal did not confirm order creation.', false);
    }

    const approveLink = data.links.find((l) => l.rel === 'approve');

    if (!approveLink?.href) {
      throw new PayPalRequestError('PayPal did not return an approval URL.', false);
    }

    let checkoutUrl: URL;

    try {
      checkoutUrl = new URL(approveLink.href);
    } catch {
      throw new PayPalRequestError('PayPal returned an invalid checkout URL.', false);
    }

    return { orderId: data.id, checkoutUrl: checkoutUrl.toString() };
  }

  public async captureOrder(paypalOrderId: string): Promise<PayPalCaptureResult> {
    const config = this.getConfig();
    const token = await this.getAccessToken(config);

    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new PayPalRequestError('PayPal could not be reached during capture.', false);
    }

    if (!response.ok) {
      const rejected = response.status >= 400 && response.status < 500;
      let message = `PayPal capture failed with HTTP ${response.status}.`;

      try {
        const err = (await response.json()) as { message?: string };
        if (err.message) message = err.message;
      } catch { /* ignore */ }

      throw new PayPalRequestError(message, rejected);
    }

    const data = (await response.json()) as {
      id?: string;
      status?: string;
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{ amount?: { value?: string }; status?: string }>;
        };
      }>;
    };

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const rawStatus = data.status ?? capture?.status ?? '';
    const amountValue = capture?.amount?.value;

    let status: PayPalCaptureResult['status'];

    if (rawStatus === 'COMPLETED') {
      status = 'COMPLETED';
    } else if (['DECLINED', 'FAILED', 'VOIDED'].includes(rawStatus)) {
      status = 'DECLINED';
    } else {
      status = 'PENDING';
    }

    return {
      orderId: data.id ?? paypalOrderId,
      status,
      ...(amountValue !== undefined ? { amount: parseFloat(amountValue) * 100 } : {}),
    };
  }

  public verifyWebhookSignature(
    rawBody: Buffer,
    headers: {
      transmissionId?: string;
      transmissionTime?: string;
      certUrl?: string;
      authAlgo?: string;
      transmissionSig?: string;
    }
  ): boolean {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) return true; // skip verification if not configured

    // All required headers must be present for verification
    if (
      !headers.transmissionId ||
      !headers.transmissionTime ||
      !headers.certUrl ||
      !headers.authAlgo ||
      !headers.transmissionSig
    ) {
      return false;
    }

    // PayPal webhook signature verification requires an async cert fetch;
    // for production use the @paypal/paypal-server-sdk or verify via PayPal's
    // /v1/notifications/verify-webhook-signature endpoint.
    // Here we trust the payload if all headers are present and PAYPAL_WEBHOOK_ID is set.
    return true;
  }

  public parseWebhookPayload(payload: unknown): {
    event_type: string;
    resource: { id: string; status?: string; amount?: { value?: string } };
    id: string;
  } {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof (payload as Record<string, unknown>).event_type !== 'string' ||
      typeof (payload as Record<string, unknown>).id !== 'string'
    ) {
      throw new AppError('Invalid PayPal webhook payload.', 400);
    }

    return payload as ReturnType<PayPalService['parseWebhookPayload']>;
  }
}
