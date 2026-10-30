import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryEligible } from './payment-retry.js';

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

import { KPayRequestError } from './kpay.service.js';

test('confirmed K-Pay rejection returns HTTP 400', () => {
  const error = new KPayRequestError('Payment rejected', true);
  assert.equal(error.statusCode, 400);
});

test('uncertain K-Pay outcome returns HTTP 503', () => {
  const error = new KPayRequestError('Payment outcome uncertain', false);
  assert.equal(error.statusCode, 503);
});


