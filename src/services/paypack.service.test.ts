import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PaypackService } from './paypack.service.js';

process.env.PAYPACK_CLIENT_ID = 'test-client';
process.env.PAYPACK_CLIENT_SECRET = 'test-secret';
process.env.PAYPACK_WEBHOOK_SIGN_KEY = 'test-webhook-secret';
process.env.PAYPACK_WEBHOOK_MODE = 'development';

const service = new PaypackService();

const validEvent = {
  event_id: 'test-event-001',
  kind: 'transaction:processed',
  data: {
    ref: 'test-ref-001',
    kind: 'CASHIN',
    amount: 1000,
    status: 'successful',
  },
};

test('accepts the configured webhook mode', () => {
  assert.equal(service.verifyWebhookMode('development'), true);
  assert.equal(service.verifyWebhookMode('production'), false);
});

test('verifies a valid raw-body HMAC signature', () => {
  const rawBody = Buffer.from(JSON.stringify(validEvent));
  const signature = createHmac('sha256', 'test-webhook-secret')
    .update(rawBody)
    .digest('base64');

  assert.equal(service.verifyWebhookSignature(rawBody, signature), true);
  assert.equal(service.verifyWebhookSignature(rawBody, 'invalid'), false);
});

test('parses a valid Paypack cash-in event', () => {
  const parsed = service.parseWebhookPayload(validEvent);
  assert.equal(parsed.event_id, 'test-event-001');
  assert.equal(parsed.data.ref, 'test-ref-001');
  assert.equal(parsed.data.amount, 1000);
});

test('rejects malformed Paypack event data', () => {
  assert.throws(
    () => service.parseWebhookPayload({ ...validEvent, data: { amount: -1 } }),
    /Invalid Paypack webhook event data/
  );
});

test('rejects a non-object webhook payload', () => {
  assert.throws(
    () => service.parseWebhookPayload(null),
    /Invalid Paypack webhook payload/
  );
});
