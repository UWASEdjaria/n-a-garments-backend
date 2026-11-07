import { prisma } from '../utils/prisma.js';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma as PrismaRuntime, PrismaClient, type Payment, type Prisma } from '@prisma/client';
import {
  InitiateGuestPaymentDTO,
  InitiatePaymentDTO,
  UpdatePaymentStatusDTO,
  PaymentResponse,
  PaymentAttemptSummary,
  InitiateCustomQuotePaymentDTO,
  CustomQuotePaymentResponse,
  CustomQuotePaymentStatusResponse,
} from '../interfaces/payment.interface.js';
import { AppError } from '../utils/appError.js';
import {
  PayPalRequestError,
  PayPalService,
  type PayPalCaptureResult,
  type PayPalWebhookHeaders,
} from './paypal.service.js';
import { PaypackRequestError, PaypackService, type PaypackWebhookPayload } from './paypack.service.js';
import { isRetryEligible } from './payment-retry.js';

const formatRwandaPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('07') && cleaned.length === 10) {
    return `250${cleaned.substring(1)}`;
  }

  if (cleaned.startsWith('7') && cleaned.length === 9) {
    return `250${cleaned}`;
  }

  return cleaned;
};

const parseUsdCents = (value: string): number | null => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;

  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));

  return Number.isSafeInteger(cents) ? cents : null;
};

export class PaymentService {
  private readonly prisma: PrismaClient;
  private readonly paypalService: PayPalService;
  private readonly paypackService: PaypackService;

  constructor(
    prismaClient: PrismaClient = prisma,
    paypalService: PayPalService = new PayPalService(),
    paypackService: PaypackService = new PaypackService()
  ) {
    this.prisma = prismaClient;
    this.paypalService = paypalService;
    this.paypackService = paypackService;
  }

  private async findQuoteByToken(token: string) {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new AppError('Quote link is invalid or expired.', 404);
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const order = await this.prisma.customOrder.findFirst({
      where: {
        quoteAccessTokenHash: tokenHash,
        quoteAccessTokenExpiresAt: { gt: new Date() },
        quoteStatus: { in: ['PROPOSED', 'ACCEPTED'] },
      },
    });

    if (!order) {
      throw new AppError('Quote link is invalid or expired.', 404);
    }

    return order;
  }

  public async initiateCustomQuotePayment(
    token: string,
    data: InitiateCustomQuotePaymentDTO
  ): Promise<CustomQuotePaymentResponse> {
    const order = await this.findQuoteByToken(token);

    if (order.quoteStatus !== 'ACCEPTED') {
      throw new AppError('Please accept the quote before making payment.', 409);
    }

    if (order.quoteTotal === null || order.advanceAmount === null) {
      throw new AppError('The quote payment amounts are incomplete.', 409);
    }

    const phoneNumber = formatRwandaPhone(data.phoneNumber);

    const payment = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const tokenHash = createHash('sha256').update(token).digest('hex');

        const currentOrder = await transaction.customOrder.findFirst({
          where: {
            id: order.id,
            quoteStatus: 'ACCEPTED',
            quoteAccessTokenHash: tokenHash,
            quoteAccessTokenExpiresAt: { gt: new Date() },
          },
        });

        if (
          !currentOrder ||
          currentOrder.quoteTotal === null ||
          currentOrder.advanceAmount === null
        ) {
          throw new AppError('Quote link is invalid or expired.', 404);
        }

        const pendingAttempt = await transaction.payment.findFirst({
          where: {
            customOrderId: currentOrder.id,
            status: 'PENDING',
          },
        });

        if (pendingAttempt) {
          throw new AppError(
            'A payment attempt is already pending. Check its status before retrying.',
            409
          );
        }

        const remainingAdvance = currentOrder.advanceAmount
          .sub(currentOrder.advancePaidAmount)
          .toNumber();

        if (!Number.isSafeInteger(remainingAdvance) || remainingAdvance <= 0) {
          throw new AppError('There is no outstanding integer advance payment.', 409);
        }

        return transaction.payment.create({
          data: {
            customOrderId: currentOrder.id,
            amount: remainingAdvance,
            paymentMethod: 'MOMO',
            provider: 'PAYPACK',
            status: 'PENDING',
            ref: `ATTEMPT-${randomUUID()}`,
            phoneNumber,
          },
        });
      },
      { maxWait: 10000, timeout: 15000 }
    );

    let cashInAccepted = false;

    try {
      const amount = payment.amount.toNumber();

      const result = await this.paypackService.cashIn({
        phoneNumber,
        amount,
        idempotencyKey: payment.id.replace(/-/g, '').slice(0, 32),
      });

      cashInAccepted = true;

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerTransactionRef: result.ref },
      });

      // Paypack processes asynchronously - rely on the webhook to confirm status.
      await this.processPendingPaypackEvents(result.ref);
    } catch (error) {
      if (
        !cashInAccepted &&
        error instanceof PaypackRequestError &&
        error.definitivelyRejected
      ) {
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      }

      throw error;
    }

    const [updatedPayment, updatedOrder] = await Promise.all([
      this.prisma.payment.findUnique({ where: { id: payment.id } }),
      this.prisma.customOrder.findUnique({ where: { id: order.id } }),
    ]);

    if (
      !updatedPayment ||
      !updatedOrder ||
      updatedOrder.quoteTotal === null ||
      updatedOrder.advanceAmount === null ||
      updatedOrder.balanceAmount === null
    ) {
      throw new AppError('Payment status could not be retrieved.', 404);
    }

    return {
      success: true,
      message: 'Custom quote payment initiated.',
      data: {
        paymentId: updatedPayment.id,
        customOrderId: updatedOrder.id,
        quoteReference: updatedOrder.quoteReference,
        amount: Number(updatedPayment.amount),
        paymentMethod: 'MOMO',
        provider: 'PAYPACK',
        status: updatedPayment.status,
        ref: updatedPayment.ref,
        quoteTotal: Number(updatedOrder.quoteTotal),
        advanceAmount: Number(updatedOrder.advanceAmount),
        advancePaidAmount: Number(updatedOrder.advancePaidAmount),
        balanceAmount: Number(updatedOrder.balanceAmount),
      },
    };
  }

  public async getCustomQuotePaymentStatus(
    token: string
  ): Promise<CustomQuotePaymentStatusResponse> {
    const order = await this.findQuoteByToken(token);

    if (
      order.quoteTotal === null ||
      order.advanceAmount === null ||
      order.balanceAmount === null
    ) {
      throw new AppError('The quote payment amounts are incomplete.', 409);
    }

    const payments = await this.prisma.payment.findMany({
      where: { customOrderId: order.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        status: true,
        ref: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      message: 'Custom quote payment status retrieved.',
      data: {
        customOrderId: order.id,
        quoteReference: order.quoteReference,
        quoteStatus: order.quoteStatus as 'PROPOSED' | 'ACCEPTED',
        paymentStatus: order.paymentStatus,
        quoteTotal: Number(order.quoteTotal),
        advanceAmount: Number(order.advanceAmount),
        advancePaidAmount: Number(order.advancePaidAmount),
        balanceAmount: Number(order.balanceAmount),
        payments: payments.map((item) => ({
          paymentId: item.id,
          amount: Number(item.amount),
          status: item.status,
          ref: item.ref,
          createdAt: item.createdAt.toISOString(),
        })),
      },
    };
  }
  public async initiateGuestPayment(
    data: InitiateGuestPaymentDTO
  ): Promise<PaymentResponse> {
    const { email, ...paymentData } = data;

    return this.initiatePayment(paymentData, undefined, email);
  }

  public async initiatePayment(
    data: InitiatePaymentDTO,
    userId?: string,
    guestEmail?: string
  ): Promise<PaymentResponse> {
    if (data.paymentMethod === 'MOMO' && !data.phoneNumber) {
      throw new AppError(
        'Phone number is required for Mobile Money payments.',
        400
      );
    }

    let payment: Payment;

    try {
      payment = await this.prisma.$transaction(
        async (transaction: Prisma.TransactionClient) => {
          const order = await transaction.order.findUnique({
            where: { id: data.orderId },
          });

          if (!order) {
            throw new AppError('Order not found.', 404);
          }

          if (guestEmail !== undefined) {
            if (
              order.userId !== null ||
              order.guestEmail?.trim().toLowerCase() !==
                guestEmail.trim().toLowerCase()
            ) {
              throw new AppError('Order not found.', 404);
            }
          } else if (!userId || order.userId !== userId) {
            throw new AppError('Order not found.', 404);
          }

          if (
            order.status === 'CANCELLED' ||
            order.paymentStatus === 'CANCELLED'
          ) {
            throw new AppError('Payment cannot be initiated for a cancelled order.', 409);
          }

          if (Number(order.totalAmount) !== data.amount) {
            throw new AppError(
              'Payment amount must match the order total.',
              400
            );
          }

          const successfulAttempt = await transaction.payment.findFirst({
            where: {
              orderId: order.id,
              status: { in: ['PAID', 'SUCCESSFUL'] },
            },
          });

          if (order.paymentStatus === 'PAID' || successfulAttempt) {
            throw new AppError('This order has already been paid.', 409);
          }

          const pendingAttempt = await transaction.payment.findFirst({
            where: {
              orderId: order.id,
              status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
          });

          if (pendingAttempt) {
             const normalizedPhone = data.phoneNumber
              ? formatRwandaPhone(data.phoneNumber)
              : null;

              const canRecoverPaypackAttempt =
                  data.paymentMethod === 'MOMO' &&
                  pendingAttempt.paymentMethod === 'MOMO' &&
                  pendingAttempt.provider === 'PAYPACK' &&
                  !pendingAttempt.providerTransactionRef &&
                   pendingAttempt.phoneNumber === normalizedPhone;

                  const canRecoverPayPalAttempt =
                    data.paymentMethod === 'CARD' &&
                    pendingAttempt.paymentMethod === 'CARD' &&
                    pendingAttempt.provider === 'PAYPAL' &&
                    !pendingAttempt.providerTransactionRef;

                  if (canRecoverPaypackAttempt || canRecoverPayPalAttempt) {
                    return pendingAttempt;
                  }

                    throw new AppError(
                    'A payment attempt is already pending. Check its status before retrying.',
                   409
                );
            }



          const attempt = await transaction.payment.create({
            data: {
              orderId: order.id,
              amount: order.totalAmount,
              paymentMethod: data.paymentMethod,
              provider:
                data.paymentMethod === 'MOMO'
                  ? 'PAYPACK'
                  : data.paymentMethod === 'CARD'
                    ? 'PAYPAL'
                    : null,
              status: 'PENDING',
              ref: `ATTEMPT-${randomUUID()}`,
              phoneNumber: data.phoneNumber
                ? formatRwandaPhone(data.phoneNumber)
                : null,
            },
          });

          await transaction.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'PENDING' },
          });

          return attempt;
        }, { maxWait: 10000, timeout: 15000 }
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      let activeAttempt: Payment | null = null;

      try {
        activeAttempt = await this.prisma.payment.findFirst({
          where: {
            orderId: data.orderId,
            status: 'PENDING',
          },
        });
      } catch {
        throw error;
      }

      if (activeAttempt) {
        throw new AppError(
          'A payment attempt is already in progress.',
          409
        );
      }

      throw error;
    }

    let checkoutUrl: string | undefined;

    if (data.paymentMethod === 'MOMO') {
      let cashInAccepted = false;

      try {
        const amount = payment.amount.toNumber();

        if (!Number.isSafeInteger(amount) || amount <= 0) {
          throw new AppError(
            'Paypack requires a positive integer RWF amount.',
            400
          );
        }

        const result = await this.paypackService.cashIn({
          phoneNumber: payment.phoneNumber || '',
          amount,
          idempotencyKey: payment.id.replace(/-/g, '').slice(0, 32),
        });

        cashInAccepted = true;

        payment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: { providerTransactionRef: result.ref },
        });

        // Paypack processes asynchronously - rely on the webhook to confirm status.
        await this.processPendingPaypackEvents(result.ref);

        const refreshedPayment = await this.prisma.payment.findUnique({
          where: { id: payment.id },
        });

        if (!refreshedPayment) {
          throw new AppError('Payment attempt was not found.', 404);
        }

        payment = refreshedPayment;
      } catch (error) {
        if (
          !cashInAccepted &&
          error instanceof PaypackRequestError &&
          error.definitivelyRejected
        ) {
          await this.prisma.$transaction(
            async (transaction: Prisma.TransactionClient) => {
              await transaction.payment.update({
                where: { id: payment.id },
                data: { status: 'FAILED' },
              });

              if (payment.orderId) {
                await transaction.order.updateMany({
                  where: {
                    id: payment.orderId,
                    paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
                    payments: { none: { status: 'PENDING' } },
                  },
                  data: { paymentStatus: 'FAILED' },
                });
              }
            }
          );
        }

        throw error;
      }
    } else if (data.paymentMethod === 'CARD') {
      try {
        const result = await this.paypalService.createOrder({
          refid: payment.ref,
          amount: payment.amount.toNumber(),
          currency: 'USD',
          description: `NA Garments order ${data.orderId}`,
        });

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerTransactionRef: result.orderId,
            providerAmount: result.amount,
          },
        });

        checkoutUrl = result.checkoutUrl;
      } catch (error) {
        if (error instanceof PayPalRequestError && error.definitivelyRejected) {
          await this.prisma.$transaction(
            async (transaction: Prisma.TransactionClient) => {
              await transaction.payment.update({
                where: { id: payment.id },
                data: { status: 'FAILED' },
              });

              if (payment.orderId) {
                await transaction.order.updateMany({
                  where: {
                    id: payment.orderId,
                    paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
                    payments: { none: { status: 'PENDING' } },
                  },
                  data: { paymentStatus: 'FAILED' },
                });
              }
            }
          );
        }

        throw error;
      }
    } else if (data.paymentMethod === 'CASH_ON_DELIVERY') {
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { ref: `COD-${randomUUID()}` },
      });
    }

    const message =
      data.paymentMethod === 'CASH_ON_DELIVERY'
        ? 'Cash on Delivery selected. Payment will be collected upon delivery.'
        : data.paymentMethod === 'MOMO'
          ? 'Paypack Mobile Money payment initialized.'
          : 'PayPal checkout initialized.';

    return this.toResponse(payment, message, false, checkoutUrl);
  }

  public async handlePaypalWebhook(
    payload: object,
    rawBody: Buffer,
    headers: PayPalWebhookHeaders
  ): Promise<void> {
    const event = this.paypalService.parseWebhookPayload(payload);

    if (!(await this.paypalService.verifyWebhookSignature(rawBody, event, headers))) {
      throw new AppError('Invalid PayPal webhook signature.', 401);
    }
    // Only handle PAYMENT.CAPTURE.COMPLETED and PAYMENT.CAPTURE.DENIED
    if (
      event.event_type !== 'PAYMENT.CAPTURE.COMPLETED' &&
      event.event_type !== 'PAYMENT.CAPTURE.DENIED'
    ) {
      return;
    }

    const paypalOrderId = event.resource.supplementary_data?.related_ids?.order_id;

    if (!paypalOrderId?.trim() || paypalOrderId !== paypalOrderId.trim()) {
      throw new AppError('PayPal capture event is missing its related order ID.', 400);
    }

    const isSuccess = event.event_type === 'PAYMENT.CAPTURE.COMPLETED';

    if (
      (isSuccess && event.resource.status !== 'COMPLETED') ||
      (!isSuccess && event.resource.status !== 'DECLINED' && event.resource.status !== 'DENIED')
    ) {
      throw new AppError('PayPal capture event type and capture status do not match.', 400);
    }

    const capturedAmount = event.resource.amount?.value;

    if (
      event.resource.amount?.currency_code !== 'USD' ||
      typeof capturedAmount !== 'string' ||
      !/^\d+(?:\.\d{1,2})?$/.test(capturedAmount) ||
      !Number.isFinite(Number(capturedAmount)) ||
      Number(capturedAmount) <= 0
    ) {
      throw new AppError('PayPal capture event has an invalid amount or currency.', 400);
    }

    const finalStatus = isSuccess ? 'PAID' : 'FAILED';

    const paymentRecord = await this.prisma.payment.findUnique({
      where: { providerTransactionRef: paypalOrderId },
    });

    if (!paymentRecord) {
      throw new AppError(
        'Payment reference is not available yet. Please retry the webhook.',
        503
      );
    }

    if (
      paymentRecord.provider !== 'PAYPAL' ||
      paymentRecord.paymentMethod !== 'CARD' ||
      !paymentRecord.orderId
    ) {
      throw new AppError('PayPal order reference does not match a card payment.', 409);
    }

    const expectedUsd = paymentRecord.providerAmount?.toFixed(2);
    const expectedCents = expectedUsd ? parseUsdCents(expectedUsd) : null;
    const webhookCents = parseUsdCents(capturedAmount);

    if (
      expectedCents === null ||
      expectedCents <= 0 ||
      webhookCents === null ||
      webhookCents <= 0 ||
      expectedCents !== webhookCents
    ) {
      throw new AppError(
        'PayPal webhook amount does not match the expected payment amount.',
        409
      );
    }

    const existingEventPayment = await this.prisma.payment.findUnique({
      where: { providerEventId: event.id },
      select: { id: true },
    });

    if (existingEventPayment) {
      if (existingEventPayment.id !== paymentRecord.id) {
        throw new AppError('PayPal webhook event ID is associated with another payment.', 409);
      }

      return;
    }

    if (paymentRecord.status === 'PAID' || paymentRecord.status === 'SUCCESSFUL') {
      return;
    }

    try {
      await this.prisma.$transaction(
        async (transaction: Prisma.TransactionClient) => {
          const payment = await transaction.payment.findUnique({
            where: { id: paymentRecord.id },
          });

          if (!payment) {
            return;
          }

          const duplicateEventPayment = await transaction.payment.findUnique({
            where: { providerEventId: event.id },
            select: { id: true },
          });

          if (duplicateEventPayment) {
            if (duplicateEventPayment.id !== payment.id) {
              throw new AppError(
                'PayPal webhook event ID is associated with another payment.',
                409
              );
            }

            return;
          }

          if (payment.status === 'PAID' || payment.status === 'SUCCESSFUL') {
            return;
          }

          if (!payment.orderId) {
            throw new AppError('Custom-order PayPal payment handling is not implemented.', 503);
          }

          if (isSuccess) {
            const orderUpdate = await transaction.order.updateMany({
              where: {
                id: payment.orderId,
                paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
              },
              data: { paymentStatus: 'PAID' },
            });

            const paymentUpdate = await transaction.payment.updateMany({
              where: { id: payment.id, status: { notIn: ['PAID', 'SUCCESSFUL'] } },
              data: {
                status: orderUpdate.count === 1 ? 'PAID' : 'SUCCESSFUL',
                providerEventId: event.id,
              },
            });

            if (paymentUpdate.count === 0) {
              if (orderUpdate.count === 0) {
                const currentPayment = await transaction.payment.findUnique({
                  where: { id: payment.id },
                });

                if (
                  currentPayment?.status === 'PAID' ||
                  currentPayment?.status === 'SUCCESSFUL'
                ) {
                  return;
                }
              }

              throw new AppError(
                'Payment state changed during PayPal capture processing. Retry the webhook.',
                503
              );
            }

            if (orderUpdate.count === 1) {
              await transaction.payment.updateMany({
                where: { orderId: payment.orderId, id: { not: payment.id }, status: 'PENDING' },
                data: { status: 'CANCELLED' },
              });
            } else {
              console.error(
                `PayPal reported another successful capture for already-paid order ${payment.orderId}; PayPal order ${paypalOrderId} requires reconciliation.`
              );
            }

            return;
          }

          const paymentUpdate = await transaction.payment.updateMany({
            where: { id: payment.id, status: { notIn: ['PAID', 'SUCCESSFUL'] } },
            data: { status: finalStatus, providerEventId: event.id },
          });

          if (paymentUpdate.count === 0) {
            return;
          }

          await transaction.order.updateMany({
            where: {
              id: payment.orderId,
              paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
              payments: { none: { status: 'PENDING' } },
            },
            data: { paymentStatus: finalStatus },
          });
        }
      );
    } catch (error) {
      if (
        error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const conflictingEvent = await this.prisma.payment.findUnique({
          where: { providerEventId: event.id },
          select: { id: true },
        });

        if (conflictingEvent?.id === paymentRecord.id) {
          return;
        }

        if (conflictingEvent) {
          throw new AppError('PayPal webhook event ID is associated with another payment.', 409);
        }
      }

      throw error;
    }
  }
  public async capturePaypalPayment(
    orderId: string,
    userId: string | undefined,
    guestEmail?: string
  ): Promise<PayPalCaptureResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, guestEmail: true, status: true, paymentStatus: true },
    });

    const ownsOrder = guestEmail !== undefined
      ? order?.userId === null &&
        order.guestEmail?.trim().toLowerCase() === guestEmail.trim().toLowerCase()
      : userId !== undefined && order?.userId === userId;

    if (!order || !ownsOrder) {
      throw new AppError('Order not found.', 404);
    }

    if (order.status === 'CANCELLED' || order.paymentStatus === 'CANCELLED') {
      throw new AppError('Payment cannot be captured for a cancelled order.', 409);
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        provider: 'PAYPAL',
        paymentMethod: 'CARD',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment || !payment.providerTransactionRef) {
      throw new AppError('A PayPal order is not available for capture.', 404);
    }

    if (payment.status !== 'PENDING') {
      throw new AppError('Only a pending PayPal payment can be captured.', 409);
    }

    const expectedUsd = payment.providerAmount?.toFixed(2);
    const expectedCents = expectedUsd ? parseUsdCents(expectedUsd) : null;

    if (expectedCents === null || expectedCents <= 0) {
      throw new AppError('The expected PayPal payment amount is missing or invalid.', 409);
    }

    const capture = await this.paypalService.captureOrder(payment.providerTransactionRef);

    if (
      !Number.isSafeInteger(capture.amount) ||
      capture.amount !== expectedCents
    ) {
      throw new AppError('PayPal capture amount does not match the expected payment amount.', 409);
    }

    return capture;
  }

  public async updatePaymentStatus(
    paymentId: string,
    dto: UpdatePaymentStatusDTO
  ): Promise<PaymentResponse> {
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const payment = await transaction.payment.findUnique({
          where: { id: paymentId },
        });

        if (!payment) {
          throw new AppError('Payment record not found.', 404);
        }

        if (!payment.orderId) {
          throw new AppError(
            'This payment is not linked to a regular order. Custom-order payment handling is not implemented.',
            400
          );
        }

        if (dto.status === 'PAID' || dto.status === 'SUCCESSFUL') {
          const order = await transaction.order.findUnique({
            where: { id: payment.orderId },
            select: { status: true, paymentStatus: true },
          });

          if (
            !order ||
            order.status === 'CANCELLED' ||
            order.paymentStatus === 'CANCELLED' ||
            order.paymentStatus === 'PAID'
          ) {
            throw new AppError(
              'A cancelled or already-paid order cannot receive this payment update.',
              409
            );
          }

          const otherSuccessfulAttempt =
            await transaction.payment.findFirst({
              where: {
                orderId: payment.orderId,
                id: { not: payment.id },
                status: { in: ['PAID', 'SUCCESSFUL'] },
              },
            });

          if (otherSuccessfulAttempt) {
            throw new AppError(
              'Another payment attempt has already succeeded for this order.',
              409
            );
          }
        }

        const updated = await transaction.payment.update({
          where: { id: paymentId },
          data: { status: dto.status },
        });

        if (dto.status === 'PAID' || dto.status === 'SUCCESSFUL') {
          const orderUpdate = await transaction.order.updateMany({
            where: {
              id: payment.orderId,
              status: { not: 'CANCELLED' },
              paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
            },
            data: { paymentStatus: 'PAID' },
          });

          if (orderUpdate.count !== 1) {
            throw new AppError(
              'The order is no longer eligible for this payment update.',
              409
            );
          }

          await transaction.payment.updateMany({
            where: {
              orderId: payment.orderId,
              id: { not: payment.id },
              status: 'PENDING',
            },
            data: { status: 'CANCELLED' },
          });
        } else if (dto.status === 'PENDING') {
          await transaction.order.updateMany({
            where: {
              id: payment.orderId,
              paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
            },
            data: { paymentStatus: 'PENDING' },
          });
        } else {
          await transaction.order.updateMany({
            where: {
              id: payment.orderId,
              paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
              payments: { none: { status: 'PENDING' } },
            },
            data: { paymentStatus: dto.status },
          });
        }

        return this.toResponse(
          updated,
          `Payment status updated to ${dto.status}`,
          isRetryEligible(updated)
        );
      }
    );
  }

  public async getPaymentByOrderId(
    orderId: string,
    userId?: string,
    guestEmail?: string
  ): Promise<PaymentResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        guestEmail: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      throw new AppError('Payment not found for this order.', 404);
    }

    if (guestEmail !== undefined) {
      if (
        order.userId !== null ||
        order.guestEmail?.trim().toLowerCase() !==
          guestEmail.trim().toLowerCase()
      ) {
        throw new AppError('Payment not found for this order.', 404);
      }
    } else if (!userId || order.userId !== userId) {
      throw new AppError('Payment not found for this order.', 404);
    }

    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    const payment = payments[0];

    if (!payment) {
      throw new AppError('Payment not found for this order.', 404);
    }

    const hasSuccessfulAttempt = payments.some((attempt) =>
      ['PAID', 'SUCCESSFUL'].includes(attempt.status)
    );

    const attempts: PaymentAttemptSummary[] = payments.map((attempt) => ({
      paymentId: attempt.id,
      amount: Number(attempt.amount),
      paymentMethod: attempt.paymentMethod,
  provider: attempt.provider,
      status: attempt.status,
      ref: attempt.ref,
      createdAt: attempt.createdAt.toISOString(),
    }));

    return {
      success: true,
      message: 'Payment attempts retrieved successfully.',
      data: this.paymentData(
        payment,
        order.paymentStatus !== 'PAID' &&
          !hasSuccessfulAttempt &&
          isRetryEligible(payment),
        attempts
      ),
    };
  }

  public async getGuestPaymentByOrderId(
    orderId: string,
    email: string
  ): Promise<PaymentResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        guestEmail: true,
      },
    });

    if (
      !order ||
      order.userId !== null ||
      order.guestEmail?.trim().toLowerCase() !== email.trim().toLowerCase()
    ) {
      throw new AppError('Payment not found for this order.', 404);
    }

    return this.getPaymentByOrderId(orderId, undefined, email);
  }

  private toResponse(
    payment: Payment,
    message: string,
    retryAvailable: boolean,
    checkoutUrl?: string
  ): PaymentResponse {
    return {
      success: true,
      message,
      data: {
        ...this.paymentData(payment, retryAvailable),
        ...(checkoutUrl ? { checkoutUrl } : {}),
      },
    };
  }

  private paymentData(
    payment: Payment,
    retryAvailable: boolean,
    attempts?: PaymentAttemptSummary[]
  ): PaymentResponse['data'] {
    if (!payment.orderId) {
      throw new AppError(
        'Cannot return a regular-order payment response for a custom-order payment.',
        400
      );
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      provider: payment.provider,
      status: payment.status,
      ref: payment.ref,
      retryAvailable,
      ...(attempts ? { attempts } : {}),
    };
  }
  private async applyPaypackTransactionStatus(
    paymentId: string,
    verified: Awaited<ReturnType<PaypackService['findTransaction']>>,
    eventId?: string
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const current = await transaction.payment.findUnique({
          where: { id: paymentId },
        });

        if (
          !current ||
          current.provider !== 'PAYPACK' ||
          current.paymentMethod !== 'MOMO' ||
          current.providerTransactionRef !== verified.ref
        ) {
          throw new AppError('Paypack payment record could not be verified.', 409);
        }

        if (verified.status === 'pending') return;

        if (current.status === 'PAID' || current.status === 'SUCCESSFUL') return;

        if (eventId) {
          const eventOwner = await transaction.payment.findFirst({
            where: { providerEventId: eventId },
          });

          if (eventOwner && eventOwner.id !== current.id) {
            throw new AppError('Paypack event has already been processed.', 409);
          }
        }

        if (verified.status === 'successful' && current.customOrderId) {
          const customOrder = await transaction.customOrder.findUnique({
            where: { id: current.customOrderId },
          });

          if (
            !customOrder ||
            customOrder.quoteStatus !== 'ACCEPTED' ||
            customOrder.quoteTotal === null ||
            customOrder.advanceAmount === null
          ) {
            throw new AppError(
              'Accepted custom quote could not be verified for payment.',
              409
            );
          }

          const newAdvancePaid = customOrder.advancePaidAmount.add(
            current.amount
          );

          if (
            newAdvancePaid.greaterThan(customOrder.advanceAmount) ||
            newAdvancePaid.greaterThan(customOrder.quoteTotal)
          ) {
            throw new AppError(
              'Verified payment exceeds the outstanding quote advance.',
              409
            );
          }

          const newBalance = customOrder.quoteTotal.sub(newAdvancePaid);

          const claimedPayment = await transaction.payment.updateMany({
            where: {
              id: current.id,
              status: 'PENDING',
              provider: 'PAYPACK',
              customOrderId: customOrder.id,
            },
            data: {
              status: 'PAID',
              ...(eventId ? { providerEventId: eventId } : {}),
            },
          });

          if (claimedPayment.count !== 1) {
            throw new AppError(
              'Custom quote payment has already been processed.',
              409
            );
          }

          const updatedQuote = await transaction.customOrder.updateMany({
            where: {
              id: customOrder.id,
              quoteStatus: 'ACCEPTED',
              advancePaidAmount: customOrder.advancePaidAmount,
            },
            data: {
              advancePaidAmount: newAdvancePaid,
              balanceAmount: newBalance,
              paymentStatus: newBalance.lessThanOrEqualTo(0)
                ? 'PAID'
                : 'PENDING',
            },
          });

          if (updatedQuote.count !== 1) {
            throw new AppError(
              'Quote payment accounting changed during processing. Please retry verification.',
              409
            );
          }

          return;
        }
        let finalStatus: 'PAID' | 'SUCCESSFUL' | 'FAILED';

        if (verified.status === 'successful') {
          if (current.orderId) {
            const claimedOrder = await transaction.order.updateMany({
              where: {
                id: current.orderId,
                paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
              },
              data: { paymentStatus: 'PAID' },
            });

            finalStatus = claimedOrder.count === 1 ? 'PAID' : 'SUCCESSFUL';

            if (claimedOrder.count === 1) {
              await transaction.payment.updateMany({
                where: {
                  orderId: current.orderId,
                  id: { not: current.id },
                  status: 'PENDING',
                },
                data: { status: 'CANCELLED' },
              });
            }
          } else {
            finalStatus = 'PAID';
          }
        } else {
          finalStatus = 'FAILED';
        }

        await transaction.payment.update({
          where: { id: current.id },
          data: {
            status: finalStatus,
            ...(eventId ? { providerEventId: eventId } : {}),
          },
        });

        if (current.orderId && finalStatus === 'FAILED') {
          await transaction.order.updateMany({
            where: {
              id: current.orderId,
              paymentStatus: { notIn: ['PAID', 'CANCELLED'] },
              payments: { none: { status: 'PENDING' } },
            },
            data: { paymentStatus: 'FAILED' },
          });
        }
      }
    );
  }

  private async processPaypackEvent(
    event: PaypackWebhookPayload
  ): Promise<boolean> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerTransactionRef: event.data.ref },
    });

    if (!payment) return false;

    if (
      payment.provider !== 'PAYPACK' ||
      payment.paymentMethod !== 'MOMO' ||
      payment.amount.toNumber() !== event.data.amount
    ) {
      throw new AppError('Paypack payment details do not match.', 409);
    }

    const verified = await this.paypackService.findTransaction(event.data.ref);

    if (
      verified.ref !== event.data.ref ||
      verified.kind !== 'CASHIN' ||
      verified.amount !== payment.amount.toNumber()
    ) {
      throw new AppError('Paypack transaction verification failed.', 409);
    }

    if (verified.status === 'pending') return false;

    if (verified.status !== event.data.status) {
      throw new AppError('Paypack transaction status does not match.', 409);
    }

    await this.applyPaypackTransactionStatus(
      payment.id,
      verified,
      event.event_id
    );

    return true;
  }

  private async processPendingPaypackEvents(ref: string): Promise<void> {
    const pendingEvents = await this.prisma.paypackWebhookEvent.findMany({
      where: {
        transactionRef: ref,
        processedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const storedEvent of pendingEvents) {
      const event = this.paypackService.parseWebhookPayload(storedEvent.payload);
      const processed = await this.processPaypackEvent(event);

      if (processed) {
        await this.prisma.paypackWebhookEvent.update({
          where: { eventId: storedEvent.eventId },
          data: { processedAt: new Date() },
        });
      }
    }
  }

  public async handlePaypackWebhook(
    payload: unknown,
    rawBody: Buffer,
    signature?: string,
    mode?: string
  ): Promise<void> {
    if (!this.paypackService.verifyWebhookMode(mode)) {
      throw new AppError('Invalid Paypack webhook mode.', 401);
    }

    if (!this.paypackService.verifyWebhookSignature(rawBody, signature)) {
      throw new AppError('Invalid Paypack webhook signature.', 401);
    }

    const event = this.paypackService.parseWebhookPayload(payload);

    if (event.data.kind !== 'CASHIN') {
      throw new AppError('Only Paypack CASHIN events are accepted.', 400);
    }

    await this.prisma.paypackWebhookEvent.upsert({
      where: { eventId: event.event_id },
      create: {
        eventId: event.event_id,
        transactionRef: event.data.ref,
        payload: event as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });

    const storedRecord = await this.prisma.paypackWebhookEvent.findUnique({
      where: { eventId: event.event_id },
    });

    if (!storedRecord || storedRecord.transactionRef !== event.data.ref) {
      throw new AppError('Paypack webhook event reference conflicts with its stored record.', 409);
    }

    const storedEvent = this.paypackService.parseWebhookPayload(storedRecord.payload);

    if (
      storedEvent.data.amount !== event.data.amount ||
      storedEvent.data.status !== event.data.status ||
      storedEvent.data.kind !== event.data.kind
    ) {
      throw new AppError('Paypack webhook event conflicts with its stored payload.', 409);
    }

    const processed = await this.processPaypackEvent(storedEvent);

    if (processed) {
      await this.prisma.paypackWebhookEvent.update({
        where: { eventId: event.event_id },
        data: { processedAt: new Date() },
      });
    }
  }

}
