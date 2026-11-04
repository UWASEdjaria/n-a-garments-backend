import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, type Payment, type Prisma } from '@prisma/client';
import { AppError } from '../utils/appError.js';
import { PaymentService } from './payment.service.js';
import { isRetryEligible } from './payment-retry.js';
import {
  PayPalRequestError,
  PayPalService,
  type PayPalCaptureResult,
  type PayPalWebhookHeaders,
  type PayPalOrderResult,
  type PayPalWebhookPayload,
} from './paypal.service.js';

const payPalEnvironmentKeys = [
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_RETURN_URL',
  'PAYPAL_CANCEL_URL',
  'PAYPAL_MODE',
  'PAYPAL_WEBHOOK_ID',
] as const;

const configurePayPalEnvironment = (): (() => void) => {
  const previous = new Map(
    payPalEnvironmentKeys.map((key) => [key, process.env[key]])
  );

  process.env.PAYPAL_CLIENT_ID = 'test-client-id';
  process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';
  process.env.PAYPAL_RETURN_URL = 'https://example.test/return';
  process.env.PAYPAL_CANCEL_URL = 'https://example.test/cancel';
  process.env.PAYPAL_MODE = 'sandbox';
  process.env.PAYPAL_WEBHOOK_ID = 'test-webhook-id';

  return () => {
    for (const key of payPalEnvironmentKeys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
};

class FailingPayPalService extends PayPalService {
  constructor(private readonly failure: Error) {
    super();
  }

  public override async createOrder(
    _input: Parameters<PayPalService['createOrder']>[0]
  ): Promise<PayPalOrderResult> {
    throw this.failure;
  }
}

class CapturingPayPalService extends PayPalService {
  public capturedOrderId = '';
  public captureCalls = 0;

  constructor(private readonly captureAmount = 1000) {
    super();
  }

  public override async captureOrder(orderId: string): Promise<PayPalCaptureResult> {
    this.captureCalls += 1;
    this.capturedOrderId = orderId;
    return { orderId, status: 'COMPLETED', amount: this.captureAmount };
  }
}

const createPayPalCaptureHarness = (
  ownerId: string | null,
  paymentStatus: string,
  providerAmount: string | null = '10.00',
  captureAmount = 1000
) => {
  const prismaClient = new PrismaClient();
  const paypalService = new CapturingPayPalService(captureAmount);
  const orderDelegate = new Proxy(prismaClient.order, {
    get(target, property, receiver) {
      if (property === 'findUnique') {
        return async () => ({
          id: 'order-1',
          userId: ownerId,
          guestEmail: ownerId === null ? 'guest@example.test' : null,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        });
      }

      return Reflect.get(target, property, receiver);
    },
  });
  const paymentDelegate = new Proxy(prismaClient.payment, {
    get(target, property, receiver) {
      if (property === 'findFirst') {
        return async () => ({
          id: 'payment-1',
          orderId: 'order-1',
          paymentMethod: 'CARD',
          provider: 'PAYPAL',
          providerTransactionRef: 'PAYPAL-ORDER-1',
          providerAmount: providerAmount === null ? null : { toFixed: () => providerAmount },
          status: paymentStatus,
        });
      }

      return Reflect.get(target, property, receiver);
    },
  });
  Object.defineProperty(prismaClient, 'order', { value: orderDelegate });
  Object.defineProperty(prismaClient, 'payment', { value: paymentDelegate });

  return {
    service: new PaymentService(prismaClient, paypalService),
    paypalService,
  };
};

const createPayPalInitiationHarness = (payPalError: Error) => {
  let paymentStatus = 'PENDING';
  let orderPaymentStatus = 'PENDING';
  const paymentRecord = (): Payment => ({
    id: 'payment-1',
    orderId: 'order-1',
    amount: { toNumber: () => 10000 },
    paymentMethod: 'CARD',
    provider: 'PAYPAL',
    providerTransactionRef: null,
    providerEventId: null,
    status: paymentStatus,
    ref: 'ATTEMPT-1',
    phoneNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customOrderId: null,
  } as Payment);
  const prismaClient = new PrismaClient();
  const paymentDelegate = new Proxy(prismaClient.payment, {
    get(target, property, receiver) {
      if (property === 'findFirst') {
        return async () => null;
      }
      if (property === 'create') {
        return async () => paymentRecord();
      }
      if (property === 'update') {
        return async (args: { data: { status: string } }) => {
          paymentStatus = args.data.status;
          return paymentRecord();
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const orderDelegate = new Proxy(prismaClient.order, {
    get(target, property, receiver) {
      if (property === 'findUnique') {
        return async () => ({
          id: 'order-1',
          userId: 'user-1',
          guestEmail: null,
          status: 'PENDING',
          paymentStatus: orderPaymentStatus,
          totalAmount: 10000,
        });
      }
      if (property === 'update' || property === 'updateMany') {
        return async (args: { data: { paymentStatus: string } }) => {
          orderPaymentStatus = args.data.paymentStatus;
          return { id: 'order-1', count: 1 };
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
  Object.defineProperty(prismaClient, 'payment', { value: paymentDelegate });
  Object.defineProperty(prismaClient, 'order', { value: orderDelegate });
  Object.defineProperty(prismaClient, '$transaction', {
    value: async <T>(
      callback: (client: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> => callback(prismaClient),
  });

  return {
    service: new PaymentService(prismaClient, new FailingPayPalService(payPalError)),
    getPaymentStatus: () => paymentStatus,
    getOrderPaymentStatus: () => orderPaymentStatus,
  };
};

class AlwaysVerifiedPayPalService extends PayPalService {
  public override async verifyWebhookSignature(
    _rawBody: Buffer,
    _payload: PayPalWebhookPayload,
    _headers: PayPalWebhookHeaders
  ): Promise<boolean> {
    return true;
  }
}

const createPayPalWebhookHarness = (
  initialPaymentStatus: string,
  initialOrderPaymentStatus: string,
  conflictingEventId?: string,
  failPaymentUpdate = false,
  providerAmount: string | null = '10.00'
) => {
  let paymentStatus = initialPaymentStatus;
  let orderPaymentStatus = initialOrderPaymentStatus;
  let providerEventId: string | null = null;
  let transactionsStarted = 0;
  const paymentRecord = (): Payment => ({
    id: 'payment-1',
    orderId: 'order-1',
    amount: { toNumber: () => 10000 },
    paymentMethod: 'CARD',
    provider: 'PAYPAL',
    providerTransactionRef: 'PAYPAL-ORDER-1',
    providerAmount: providerAmount === null ? null : { toFixed: () => providerAmount },
    providerEventId,
    status: paymentStatus,
    ref: 'ATTEMPT-1',
    phoneNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customOrderId: null,
  } as Payment);
  const findPayment = async (args: {
    where: {
      providerTransactionRef?: string;
      providerEventId?: string;
      id?: string;
    };
  }): Promise<Payment | { id: string } | null> => {
    if (args.where.providerTransactionRef === 'PAYPAL-ORDER-1' || args.where.id === 'payment-1') {
      return paymentRecord();
    }

    if (args.where.providerEventId) {
      if (args.where.providerEventId === conflictingEventId) {
        return { id: 'another-payment' };
      }

      if (args.where.providerEventId === providerEventId) {
        return { id: 'payment-1' };
      }
    }

    return null;
  };
  const prismaClient = new PrismaClient();
  const paymentDelegate = new Proxy(prismaClient.payment, {
    get(target, property, receiver) {
      if (property === 'findUnique') {
        return findPayment;
      }
      if (property === 'updateMany') {
        return async (args: {
          where: { id?: string | { not: string }; status?: { notIn: string[] } };
          data: { status: string; providerEventId?: string };
        }) => {
          if (typeof args.where.id !== 'string' || args.where.id !== 'payment-1') {
            return { count: 0 };
          }

          if (failPaymentUpdate && args.data.providerEventId) {
            return { count: 0 };
          }

          if (args.where.status?.notIn.includes(paymentStatus)) {
            return { count: 0 };
          }

          paymentStatus = args.data.status;
          if (args.data.providerEventId) {
            providerEventId = args.data.providerEventId;
          }

          return { count: 1 };
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const orderDelegate = new Proxy(prismaClient.order, {
    get(target, property, receiver) {
      if (property === 'updateMany') {
        return async (args: {
          where: {
            paymentStatus: { notIn: string[] };
            payments?: { none: { status: string } };
          };
          data: { paymentStatus: string };
        }) => {
          if (args.where.paymentStatus.notIn.includes(orderPaymentStatus)) {
            return { count: 0 };
          }

          if (args.where.payments && paymentStatus === args.where.payments.none.status) {
            return { count: 0 };
          }

          orderPaymentStatus = args.data.paymentStatus;
          return { count: 1 };
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
  Object.defineProperty(prismaClient, 'payment', { value: paymentDelegate });
  Object.defineProperty(prismaClient, 'order', { value: orderDelegate });
  Object.defineProperty(prismaClient, '$transaction', {
    value: async <T>(
      callback: (client: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> => {
      transactionsStarted += 1;
      const previousPaymentStatus = paymentStatus;
      const previousOrderPaymentStatus = orderPaymentStatus;
      const previousProviderEventId = providerEventId;

      try {
        return await callback(prismaClient);
      } catch (error) {
        paymentStatus = previousPaymentStatus;
        orderPaymentStatus = previousOrderPaymentStatus;
        providerEventId = previousProviderEventId;
        throw error;
      }
    },
  });

  return {
    service: new PaymentService(prismaClient, new AlwaysVerifiedPayPalService()),
    getPaymentStatus: () => paymentStatus,
    getOrderPaymentStatus: () => orderPaymentStatus,
    getProviderEventId: () => providerEventId,
    getTransactionsStarted: () => transactionsStarted,
  };
};

const makePayPalCaptureEvent = (
  eventType: 'PAYMENT.CAPTURE.COMPLETED' | 'PAYMENT.CAPTURE.DENIED',
  eventId: string,
  status: string,
  orderId = 'PAYPAL-ORDER-1'
): PayPalWebhookPayload => ({
  event_type: eventType,
  id: eventId,
  resource: {
    id: 'PAYPAL-CAPTURE-1',
    status,
    amount: { value: '10.00', currency_code: 'USD' },
    supplementary_data: { related_ids: { order_id: orderId } },
  },
});

test('FAILED payment can be retried', () => {
  assert.equal(isRetryEligible({ status: 'FAILED' }), true);
});

test('CANCELLED payment can be retried', () => {
  assert.equal(isRetryEligible({ status: 'CANCELLED' }), true);
});

test('old PENDING payment cannot automatically be retried', () => {
  assert.equal(isRetryEligible({ status: 'PENDING' }), false);
});

test('PAID payment cannot be retried', () => {
  assert.equal(isRetryEligible({ status: 'PAID' }), false);
});

test('SUCCESSFUL payment cannot be retried', () => {
  assert.equal(isRetryEligible({ status: 'SUCCESSFUL' }), false);
});

test('confirmed PayPal rejection returns HTTP 400', () => {
  const error = new PayPalRequestError('Payment rejected', true);
  assert.equal(error.statusCode, 400);
});

test('uncertain PayPal outcome returns HTTP 503', () => {
  const error = new PayPalRequestError('Payment outcome uncertain', false);
  assert.equal(error.statusCode, 503);
});

test('CARD initiation marks only a definitively rejected PayPal attempt as failed', async () => {
  const definite = createPayPalInitiationHarness(
    new PayPalRequestError('PayPal rejected the order', true)
  );
  const uncertain = createPayPalInitiationHarness(
    new PayPalRequestError('PayPal outcome is uncertain', false)
  );
  const unavailable = createPayPalInitiationHarness(
    new AppError('PayPal is not configured.', 503)
  );
  const input = {
    orderId: 'order-1',
    amount: 10000,
    paymentMethod: 'CARD' as const,
  };

  await assert.rejects(definite.service.initiatePayment(input, 'user-1'));
  assert.equal(definite.getPaymentStatus(), 'FAILED');
  assert.equal(definite.getOrderPaymentStatus(), 'FAILED');

  await assert.rejects(uncertain.service.initiatePayment(input, 'user-1'));
  assert.equal(uncertain.getPaymentStatus(), 'PENDING');
  assert.equal(uncertain.getOrderPaymentStatus(), 'PENDING');

  await assert.rejects(unavailable.service.initiatePayment(input, 'user-1'));
  assert.equal(unavailable.getPaymentStatus(), 'PENDING');
  assert.equal(unavailable.getOrderPaymentStatus(), 'PENDING');
});

test('PayPal capture is limited to the owning customer and pending order payment', async () => {
  const allowed = createPayPalCaptureHarness('user-1', 'PENDING');
  const result = await allowed.service.capturePaypalPayment('order-1', 'user-1');

  assert.equal(allowed.paypalService.capturedOrderId, 'PAYPAL-ORDER-1');
  assert.equal(result.status, 'COMPLETED');

  const wrongOwner = createPayPalCaptureHarness('another-user', 'PENDING');
  await assert.rejects(
    wrongOwner.service.capturePaypalPayment('order-1', 'user-1'),
    (error: Error) => error instanceof AppError && error.statusCode === 404
  );
  assert.equal(wrongOwner.paypalService.capturedOrderId, '');

  const alreadyFinished = createPayPalCaptureHarness('user-1', 'PAID');
  await assert.rejects(
    alreadyFinished.service.capturePaypalPayment('order-1', 'user-1'),
    (error: Error) => error instanceof AppError && error.statusCode === 409
  );
  assert.equal(alreadyFinished.paypalService.capturedOrderId, '');

  const guest = createPayPalCaptureHarness(null, 'PENDING');
  await guest.service.capturePaypalPayment(
    'order-1',
    undefined,
    'GUEST@example.test'
  );
  assert.equal(guest.paypalService.capturedOrderId, 'PAYPAL-ORDER-1');

  const wrongGuestEmail = createPayPalCaptureHarness(null, 'PENDING');
  await assert.rejects(
    wrongGuestEmail.service.capturePaypalPayment(
      'order-1',
      undefined,
      'attacker@example.test'
    ),
    (error: Error) => error instanceof AppError && error.statusCode === 404
  );
  assert.equal(wrongGuestEmail.paypalService.capturedOrderId, '');
});

test('PayPal capture rejects a provider amount that differs from the expected amount', async () => {
  const harness = createPayPalCaptureHarness('user-1', 'PENDING', '12.00', 1000);

  await assert.rejects(
    harness.service.capturePaypalPayment('order-1', 'user-1'),
    /capture amount does not match the expected payment amount/i
  );

  assert.equal(harness.paypalService.captureCalls, 1);
});

test('PayPal capture rejects a missing expected amount before calling PayPal', async () => {
  const harness = createPayPalCaptureHarness('user-1', 'PENDING', null);

  await assert.rejects(
    harness.service.capturePaypalPayment('order-1', 'user-1'),
    /expected PayPal payment amount is missing or invalid/i
  );

  assert.equal(harness.paypalService.captureCalls, 0);
});

test('PayPal refuses fallback exchange rates before requesting an order', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    return new Response('unavailable', { status: 503 });
  };

  try {
    await assert.rejects(
      new PayPalService().createOrder({
        refid: 'payment-attempt-fallback',
        amount: 10000,
        currency: 'USD',
        description: 'Test order',
      }),
      (error: Error) => error instanceof AppError && error.statusCode === 503
    );
    assert.equal(requestedUrls.some((url) => url.includes('/v2/checkout/orders')), false);
    assert.equal(requestedUrls.some((url) => url.includes('/v1/oauth2/token')), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal rejects non-USD and invalid RWF amounts without making requests', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 500 });
  };

  try {
    const service = new PayPalService();
    const baseInput = {
      refid: 'payment-attempt-invalid',
      amount: 10000,
      currency: 'USD',
      description: 'Test order',
    };

    await assert.rejects(
      service.createOrder({ ...baseInput, currency: 'RWF' }),
      (error: Error) => error instanceof AppError && error.statusCode === 400
    );

    for (const amount of [0, -1, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(
        service.createOrder({ ...baseInput, amount }),
        (error: Error) => error instanceof AppError && error.statusCode === 400
      );
    }

    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal order amounts convert whole RWF to rounded USD', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  const orderRequestBodies: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes('open.er-api.com')) {
      return new Response(
        JSON.stringify({ result: 'success', base_code: 'RWF', rates: { RWF: 1, USD: 0.001 } }),
        { status: 200 }
      );
    }

    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }

    if (url.endsWith('/v2/checkout/orders')) {
      orderRequestBodies.push(String(init?.body));
      return new Response(
        JSON.stringify({
          id: 'PAYPAL-ORDER-1',
          links: [{ rel: 'approve', href: 'https://www.paypal.com/checkout' }],
        }),
        { status: 201 }
      );
    }

    throw new Error(`Unexpected PayPal request: ${url}`);
  };

  try {
    const result = await new PayPalService().createOrder({
      refid: 'payment-attempt-1',
      amount: 1234,
      currency: 'USD',
      description: 'Test order',
    });
    const roundedResult = await new PayPalService().createOrder({
      refid: 'payment-attempt-2',
      amount: 1236,
      currency: 'USD',
      description: 'Test order',
    });
    const request = JSON.parse(orderRequestBodies[0]) as {
      purchase_units: Array<{ amount: { currency_code: string; value: string } }>;
    };
    const roundedRequest = JSON.parse(orderRequestBodies[1]) as {
      purchase_units: Array<{ amount: { currency_code: string; value: string } }>;
    };

    assert.equal(result.orderId, 'PAYPAL-ORDER-1');
    assert.equal(request.purchase_units[0].amount.currency_code, 'USD');
    assert.equal(request.purchase_units[0].amount.value, '1.23');
    assert.equal(roundedResult.orderId, 'PAYPAL-ORDER-1');
    assert.equal(roundedRequest.purchase_units[0].amount.value, '1.24');

    await assert.rejects(
      new PayPalService().createOrder({
        refid: 'payment-attempt-too-small',
        amount: 1,
        currency: 'USD',
        description: 'Test order',
      }),
      (error: Error) => error instanceof AppError && error.statusCode === 400
    );
    assert.equal(orderRequestBodies.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal OAuth and order network failures remain uncertain without exposing secrets', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  const errors: Error[] = [];
  let failingEndpoint: 'oauth' | 'order' = 'oauth';

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.endsWith('/v1/oauth2/token')) {
      if (failingEndpoint === 'oauth') {
        throw new Error('test-client-secret leaked from transport');
      }

      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }

    throw new Error('access-token leaked from transport');
  };

  try {
    for (const endpoint of ['oauth', 'order'] as const) {
      failingEndpoint = endpoint;
      await assert.rejects(
        new PayPalService().createOrder({
          refid: `payment-attempt-network-${endpoint}`,
          amount: 10000,
          currency: 'USD',
          description: 'Test order',
        }),
        (error: Error) => {
          errors.push(error);
          return error instanceof PayPalRequestError &&
            error.statusCode === 503 &&
            !error.definitivelyRejected;
        }
      );
    }

    assert.equal(errors.some((error) => /secret|token/i.test(error.message)), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal definitive order rejections are separated from provider errors', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }

    return new Response(
      JSON.stringify({ message: 'provider detail must not be exposed' }),
      { status: 422 }
    );
  };

  try {
    await assert.rejects(
      new PayPalService().createOrder({
        refid: 'payment-attempt-rejected',
        amount: 10000,
        currency: 'USD',
        description: 'Test order',
      }),
      (error: Error) =>
        error instanceof PayPalRequestError &&
        error.definitivelyRejected &&
        error.statusCode === 400 &&
        !error.message.includes('provider detail')
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal webhook verification reports missing webhook configuration as HTTP 503', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  delete process.env.PAYPAL_WEBHOOK_ID;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(null, { status: 500 });
  };

  try {
    await assert.rejects(
      new PayPalService().verifyWebhookSignature(
        Buffer.from('{}'),
        { event_type: 'PAYMENT.CAPTURE.COMPLETED', id: 'WH-1', resource: { id: 'CAP-1' } },
        {}
      ),
      (error: Error) => error instanceof AppError && error.statusCode === 503
    );

    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal webhook verification requires all transmission headers', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 500 });
  };
  const completeHeaders: PayPalWebhookHeaders = {
    transmissionId: 'transmission-1',
    transmissionTime: '2026-11-04T00:00:00Z',
    certUrl: 'https://api.paypal.com/cert',
    authAlgo: 'SHA256withRSA',
    transmissionSig: 'test-signature',
  };
  const missingHeaders: PayPalWebhookHeaders[] = [
    { ...completeHeaders, transmissionId: undefined },
    { ...completeHeaders, transmissionTime: undefined },
    { ...completeHeaders, certUrl: undefined },
    { ...completeHeaders, authAlgo: undefined },
    { ...completeHeaders, transmissionSig: undefined },
  ];

  try {
    for (const headers of missingHeaders) {
      const verified = await new PayPalService().verifyWebhookSignature(
        Buffer.from('{}'),
        { event_type: 'PAYMENT.CAPTURE.COMPLETED', id: 'WH-1', resource: { id: 'CAP-1' } },
        headers
      );
      assert.equal(verified, false);
    }

    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal webhook verification sends the event to PayPal and rejects invalid signatures', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  const payload: PayPalWebhookPayload = {
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    id: 'WH-1',
    resource: {
      id: 'CAP-1',
      status: 'COMPLETED',
      amount: { value: '1.23' },
      supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } },
    },
  };
  const headers: PayPalWebhookHeaders = {
    transmissionId: 'transmission-1',
    transmissionTime: '2026-11-04T00:00:00Z',
    certUrl: 'https://api.paypal.com/cert',
    authAlgo: 'SHA256withRSA',
    transmissionSig: 'test-signature',
  };
  let verificationRequestBody = '';
  let verificationStatus = 'FAILURE';

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }

    if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
      verificationRequestBody = String(init?.body);
      return new Response(JSON.stringify({ verification_status: verificationStatus }), { status: 200 });
    }

    throw new Error(`Unexpected PayPal request: ${url}`);
  };

  try {
    const verified = await new PayPalService().verifyWebhookSignature(
      Buffer.from(JSON.stringify(payload)),
      payload,
      headers
    );
    verificationStatus = 'SUCCESS';
    const validSignature = await new PayPalService().verifyWebhookSignature(
      Buffer.from(JSON.stringify(payload)),
      payload,
      headers
    );
    const request = JSON.parse(verificationRequestBody) as {
      webhook_id: string;
      webhook_event: PayPalWebhookPayload;
      transmission_id: string;
      transmission_time: string;
      cert_url: string;
      auth_algo: string;
      transmission_sig: string;
    };

    assert.equal(verified, false);
    assert.equal(validSignature, true);
    assert.equal(request.webhook_id, 'test-webhook-id');
    assert.equal(request.transmission_id, headers.transmissionId);
    assert.equal(request.transmission_time, headers.transmissionTime);
    assert.equal(request.cert_url, headers.certUrl);
    assert.equal(request.auth_algo, headers.authAlgo);
    assert.equal(request.transmission_sig, headers.transmissionSig);
    assert.deepEqual(request.webhook_event, payload);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('malformed PayPal capture responses are treated as uncertain outcomes', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }

    return new Response('invalid JSON', { status: 200 });
  };

  try {
    await assert.rejects(
      new PayPalService().captureOrder('PAYPAL-ORDER-1'),
      (error: Error) =>
        error instanceof PayPalRequestError &&
        error.statusCode === 503 &&
        !error.definitivelyRejected
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal capture requires a complete matching USD capture response', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  let captureRequestId = '';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }

    captureRequestId = new Headers(init?.headers).get('PayPal-Request-Id') ?? '';
    return new Response(
      JSON.stringify({
        id: 'PAYPAL-ORDER-1',
        status: 'COMPLETED',
        purchase_units: [{
          payments: {
            captures: [{
              id: 'PAYPAL-CAPTURE-1',
              status: 'COMPLETED',
              amount: { value: '1.23', currency_code: 'USD' },
            }],
          },
        }],
      }),
      { status: 201 }
    );
  };

  try {
    const result = await new PayPalService().captureOrder('PAYPAL-ORDER-1');
    assert.equal(result.orderId, 'PAYPAL-ORDER-1');
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.amount, 123);
    assert.equal(captureRequestId, 'PAYPAL-ORDER-1');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal webhook verification reports provider failures as HTTP 503', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }

    return new Response('unavailable', { status: 503 });
  };

  try {
    await assert.rejects(
      new PayPalService().verifyWebhookSignature(
        Buffer.from('{}'),
        { event_type: 'PAYMENT.CAPTURE.COMPLETED', id: 'WH-1', resource: { id: 'CAP-1' } },
        {
          transmissionId: 'transmission-1',
          transmissionTime: '2026-11-04T00:00:00Z',
          certUrl: 'https://api.paypal.com/cert',
          authAlgo: 'SHA256withRSA',
          transmissionSig: 'test-signature',
        }
      ),
      (error: Error) => error instanceof AppError && error.statusCode === 503
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal webhook verification reports unusable success responses as HTTP 503', async () => {
  const restoreEnvironment = configurePayPalEnvironment();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/v1/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }

    return new Response('null', { status: 200 });
  };

  try {
    await assert.rejects(
      new PayPalService().verifyWebhookSignature(
        Buffer.from('{}'),
        { event_type: 'PAYMENT.CAPTURE.COMPLETED', id: 'WH-1', resource: { id: 'CAP-1' } },
        {
          transmissionId: 'transmission-1',
          transmissionTime: '2026-11-04T00:00:00Z',
          certUrl: 'https://api.paypal.com/cert',
          authAlgo: 'SHA256withRSA',
          transmissionSig: 'test-signature',
        }
      ),
      (error: Error) => error instanceof AppError && error.statusCode === 503
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('PayPal webhook rejects malformed payloads and capture events without order references', async () => {
  const service = new PayPalService();

  assert.throws(
    () => service.parseWebhookPayload({ event_type: 'PAYMENT.CAPTURE.COMPLETED', id: '', resource: { id: 'CAP-1' } }),
    (error: Error) => error instanceof AppError && error.statusCode === 400
  );
  assert.throws(
    () => service.parseWebhookPayload({ event_type: 'PAYMENT.CAPTURE.COMPLETED', id: 'WH-1', resource: null }),
    (error: Error) => error instanceof AppError && error.statusCode === 400
  );

  const harness = createPayPalWebhookHarness('PENDING', 'PENDING');
  await assert.rejects(
    harness.service.handlePaypalWebhook(
      makePayPalCaptureEvent('PAYMENT.CAPTURE.COMPLETED', 'WH-MISSING-ORDER', 'COMPLETED', ''),
      Buffer.from('{}'),
      {}
    ),
    (error: Error) => error instanceof AppError && error.statusCode === 400
  );
  await assert.rejects(
    harness.service.handlePaypalWebhook(
      makePayPalCaptureEvent('PAYMENT.CAPTURE.COMPLETED', 'WH-STATUS-MISMATCH', 'DENIED'),
      Buffer.from('{}'),
      {}
    ),
    (error: Error) => error instanceof AppError && error.statusCode === 400
  );
  assert.equal(harness.getTransactionsStarted(), 0);
});

test('PayPal webhook rejects a capture amount that differs from the expected amount', async () => {
  const harness = createPayPalWebhookHarness('PENDING', 'PENDING', undefined, false, '12.00');

  await assert.rejects(
    harness.service.handlePaypalWebhook(
      makePayPalCaptureEvent('PAYMENT.CAPTURE.COMPLETED', 'WH-AMOUNT-MISMATCH', 'COMPLETED'),
      Buffer.from('{}'),
      {}
    ),
    (error: Error) => error instanceof AppError && error.statusCode === 409
  );

  assert.equal(harness.getPaymentStatus(), 'PENDING');
  assert.equal(harness.getOrderPaymentStatus(), 'PENDING');
  assert.equal(harness.getProviderEventId(), null);
  assert.equal(harness.getTransactionsStarted(), 0);
});

test('PayPal webhook rejects a missing expected amount', async () => {
  const harness = createPayPalWebhookHarness('PENDING', 'PENDING', undefined, false, null);

  await assert.rejects(
    harness.service.handlePaypalWebhook(
      makePayPalCaptureEvent('PAYMENT.CAPTURE.COMPLETED', 'WH-AMOUNT-MISSING', 'COMPLETED'),
      Buffer.from('{}'),
      {}
    ),
    (error: Error) => error instanceof AppError && error.statusCode === 409
  );

  assert.equal(harness.getPaymentStatus(), 'PENDING');
  assert.equal(harness.getOrderPaymentStatus(), 'PENDING');
  assert.equal(harness.getProviderEventId(), null);
  assert.equal(harness.getTransactionsStarted(), 0);
});

test('completed PayPal capture recovers a failed payment and marks its order paid', async () => {
  const harness = createPayPalWebhookHarness('FAILED', 'FAILED');

  await harness.service.handlePaypalWebhook(
    makePayPalCaptureEvent('PAYMENT.CAPTURE.COMPLETED', 'WH-COMPLETED-1', 'COMPLETED'),
    Buffer.from('{}'),
    {}
  );

  assert.equal(harness.getPaymentStatus(), 'PAID');
  assert.equal(harness.getOrderPaymentStatus(), 'PAID');
  assert.equal(harness.getProviderEventId(), 'WH-COMPLETED-1');
});

test('completed capture rolls back the order update if the payment update fails', async () => {
  const harness = createPayPalWebhookHarness('PENDING', 'PENDING', undefined, true);

  await assert.rejects(
    harness.service.handlePaypalWebhook(
      makePayPalCaptureEvent('PAYMENT.CAPTURE.COMPLETED', 'WH-ROLLBACK-1', 'COMPLETED'),
      Buffer.from('{}'),
      {}
    ),
    (error: Error) => error instanceof AppError && error.statusCode === 503
  );

  assert.equal(harness.getPaymentStatus(), 'PENDING');
  assert.equal(harness.getOrderPaymentStatus(), 'PENDING');
  assert.equal(harness.getProviderEventId(), null);
});

test('denied PayPal capture fails its payment and order', async () => {
  const harness = createPayPalWebhookHarness('PENDING', 'PENDING');

  await harness.service.handlePaypalWebhook(
    makePayPalCaptureEvent('PAYMENT.CAPTURE.DENIED', 'WH-DENIED-1', 'DENIED'),
    Buffer.from('{}'),
    {}
  );

  assert.equal(harness.getPaymentStatus(), 'FAILED');
  assert.equal(harness.getOrderPaymentStatus(), 'FAILED');
  assert.equal(harness.getProviderEventId(), 'WH-DENIED-1');
});

test('duplicate PayPal webhook delivery is idempotent', async () => {
  const harness = createPayPalWebhookHarness('PENDING', 'PENDING');
  const event = makePayPalCaptureEvent(
    'PAYMENT.CAPTURE.COMPLETED',
    'WH-DUPLICATE-1',
    'COMPLETED'
  );

  await harness.service.handlePaypalWebhook(event, Buffer.from('{}'), {});
  await harness.service.handlePaypalWebhook(event, Buffer.from('{}'), {});

  assert.equal(harness.getPaymentStatus(), 'PAID');
  assert.equal(harness.getOrderPaymentStatus(), 'PAID');
  assert.equal(harness.getTransactionsStarted(), 1);
});

test('concurrent duplicate PayPal webhook deliveries preserve terminal statuses', async () => {
  const harness = createPayPalWebhookHarness('PENDING', 'PENDING');
  const event = makePayPalCaptureEvent(
    'PAYMENT.CAPTURE.COMPLETED',
    'WH-CONCURRENT-1',
    'COMPLETED'
  );

  await Promise.all([
    harness.service.handlePaypalWebhook(event, Buffer.from('{}'), {}),
    harness.service.handlePaypalWebhook(event, Buffer.from('{}'), {}),
  ]);

  assert.equal(harness.getPaymentStatus(), 'PAID');
  assert.equal(harness.getOrderPaymentStatus(), 'PAID');
  assert.equal(harness.getProviderEventId(), 'WH-CONCURRENT-1');
});

test('a PayPal event ID associated with another payment is rejected', async () => {
  const harness = createPayPalWebhookHarness('PENDING', 'PENDING', 'WH-CONFLICT-1');

  await assert.rejects(
    harness.service.handlePaypalWebhook(
      makePayPalCaptureEvent('PAYMENT.CAPTURE.COMPLETED', 'WH-CONFLICT-1', 'COMPLETED'),
      Buffer.from('{}'),
      {}
    ),
    (error: Error) => error instanceof AppError && error.statusCode === 409
  );
  assert.equal(harness.getPaymentStatus(), 'PENDING');
  assert.equal(harness.getTransactionsStarted(), 0);
});

test('a denied webhook cannot downgrade an already-paid payment', async () => {
  const harness = createPayPalWebhookHarness('PAID', 'PAID');

  await harness.service.handlePaypalWebhook(
    makePayPalCaptureEvent('PAYMENT.CAPTURE.DENIED', 'WH-DENIED-AFTER-PAID', 'DENIED'),
    Buffer.from('{}'),
    {}
  );

  assert.equal(harness.getPaymentStatus(), 'PAID');
  assert.equal(harness.getOrderPaymentStatus(), 'PAID');
  assert.equal(harness.getTransactionsStarted(), 0);
});

test('PayPal capture webhook rejects an invalid or non-USD amount', async () => {
  const harness = createPayPalWebhookHarness('PENDING', 'PENDING');
  const event = makePayPalCaptureEvent(
    'PAYMENT.CAPTURE.COMPLETED',
    'WH-INVALID-AMOUNT',
    'COMPLETED'
  );
  event.resource.amount = { value: '10.00', currency_code: 'RWF' };

  await assert.rejects(
    harness.service.handlePaypalWebhook(event, Buffer.from('{}'), {}),
    (error: Error) => error instanceof AppError && error.statusCode === 400
  );
  assert.equal(harness.getTransactionsStarted(), 0);
});
