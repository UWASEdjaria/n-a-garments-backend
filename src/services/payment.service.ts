import { randomUUID } from 'node:crypto';
import { PrismaClient, type Payment, type Prisma } from '@prisma/client';
import {
  InitiateGuestPaymentDTO,
  InitiatePaymentDTO,
  UpdatePaymentStatusDTO,
  PaymentResponse,
  PaymentAttemptSummary,
} from '../interfaces/payment.interface.js';
import { AppError } from '../utils/appError.js';
import { KPayRequestError, KPayService } from './kpay.service.js';
import { isRetryEligible } from './payment-retry.js';

const prisma = new PrismaClient();

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


export class PaymentService {
  private kpayService = new KPayService();

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
      payment = await prisma.$transaction(
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

          if (pendingAttempt && !isRetryEligible(pendingAttempt)) {
            throw new AppError(
              'A payment attempt is already pending. Check its status before retrying.',
              409
            );
          }

          if (pendingAttempt) {
            await transaction.payment.update({
              where: { id: pendingAttempt.id },
              data: { status: 'FAILED' },
            });
          }

          const attempt = await transaction.payment.create({
            data: {
              orderId: order.id,
              amount: order.totalAmount,
              paymentMethod: data.paymentMethod,
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
        }
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const activeAttempt = await prisma.payment.findFirst({
        where: {
          orderId: data.orderId,
          status: 'PENDING',
        },
      });

      if (activeAttempt) {
        throw new AppError(
          'A payment attempt is already in progress.',
          409
        );
      }

      throw error;
    }

    let checkoutUrl: string | undefined;

    if (data.paymentMethod === 'MOMO' || data.paymentMethod === 'CARD') {
      try {
        if (!Number.isSafeInteger(payment.amount.toNumber())) {
          throw new AppError(
            'K-Pay requires an integer RWF amount. Please contact support.',
            400
          );
        }

        const orderDetails = await prisma.order.findUnique({
          where: { id: data.orderId },
          select: {
            id: true,
            guestEmail: true,
            guestName: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        });

        if (!orderDetails) {
          throw new AppError('Order not found.', 404);
        }

        const customerEmail =
          orderDetails.guestEmail?.trim() ||
          orderDetails.user?.email?.trim();

        if (!customerEmail) {
          throw new AppError(
            'A customer email is required for K-Pay checkout.',
            400
          );
        }

        const result = await this.kpayService.initiatePayment({
          refid: payment.ref,
          phoneNumber: payment.phoneNumber || '',
          email: customerEmail,
          details: `Nagarments order ${orderDetails.id}`,
          amount: payment.amount.toNumber(),
          customerName:
            orderDetails.guestName?.trim() ||
            orderDetails.user?.name?.trim() ||
            'Nagarments Customer',
          customerNumber: orderDetails.id,
          paymentMethod: data.paymentMethod === 'MOMO' ? 'momo' : 'cc',
        });

        checkoutUrl = result.url;
      } catch (error) {
        if (
          error instanceof KPayRequestError &&
          error.definitivelyRejected
        ) {
          await prisma.$transaction(
            async (transaction: Prisma.TransactionClient) => {
              await transaction.payment.update({
                where: { id: payment.id },
                data: { status: 'FAILED' },
              });

              if (payment.orderId) {
                await transaction.order.updateMany({
                  where: {
                    id: payment.orderId,
                    paymentStatus: { not: 'PAID' },
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
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { ref: `COD-${randomUUID()}` },
      });
    }

    const message =
      data.paymentMethod === 'CASH_ON_DELIVERY'
        ? 'Cash on Delivery selected. Payment will be collected upon delivery.'
        : data.paymentMethod === 'MOMO'
          ? 'K-Pay Mobile Money checkout initialized.'
          : 'K-Pay card checkout initialized.';

    return this.toResponse(payment, message, false, checkoutUrl);
  }

  public async handleKpayWebhook(payload: {
    refid: string;
    statusid: string;
  }): Promise<void> {
    const paymentRecord = await prisma.payment.findUnique({
      where: { ref: payload.refid },
    });

    if (!paymentRecord) {
      throw new AppError(
        'Payment reference is not available yet. Please retry the webhook.',
        503
      );
    }

    const verified = await this.kpayService.checkStatus(payload.refid);

    if (
      verified.refid !== paymentRecord.ref ||
      verified.statusid !== payload.statusid
    ) {
      throw new AppError(
        'K-Pay callback did not match the independently verified payment status.',
        503
      );
    }

    if (
      verified.amount !== undefined &&
      Number(verified.amount) !== Number(paymentRecord.amount)
    ) {
      throw new AppError(
        'K-Pay transaction amount does not match the recorded payment.',
        503
      );
    }

    if (verified.statusid === '03') {
      return;
    }

    const isSuccess = verified.statusid === '01';
    const finalStatus = isSuccess ? 'PAID' : 'FAILED';

    await prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const payment = await transaction.payment.findUnique({
          where: { ref: payload.refid },
        });

        if (!payment) {
          throw new AppError('Payment record not found.', 503);
        }

        if (
          payment.status === 'PAID' ||
          payment.status === 'SUCCESSFUL'
        ) {
          return;
        }

        if (!payment.orderId) {
          throw new AppError(
            'Custom-order payment handling is not implemented.',
            503
          );
        }

        if (isSuccess) {
          const orderUpdate = await transaction.order.updateMany({
            where: {
              id: payment.orderId,
              paymentStatus: { not: 'PAID' },
            },
            data: { paymentStatus: 'PAID' },
          });

          await transaction.payment.updateMany({
            where: {
              id: payment.id,
              status: { notIn: ['PAID', 'SUCCESSFUL'] },
            },
            data: {
              status: orderUpdate.count === 1 ? 'PAID' : 'SUCCESSFUL',
            },
          });

          if (orderUpdate.count === 1) {
            await transaction.payment.updateMany({
              where: {
                orderId: payment.orderId,
                id: { not: payment.id },
                status: 'PENDING',
              },
              data: { status: 'CANCELLED' },
            });
          } else {
            console.error(
              `K-Pay reported another successful attempt for already-paid order ${payment.orderId}; reference ${payload.refid} requires reconciliation.`
            );
          }

          return;
        }

        await transaction.payment.updateMany({
          where: {
            id: payment.id,
            status: { notIn: ['PAID', 'SUCCESSFUL'] },
          },
          data: { status: finalStatus },
        });

        await transaction.order.updateMany({
          where: {
            id: payment.orderId,
            paymentStatus: { not: 'PAID' },
            payments: { none: { status: 'PENDING' } },
          },
          data: { paymentStatus: finalStatus },
        });
      }
    );
  }
  public async updatePaymentStatus(
    paymentId: string,
    dto: UpdatePaymentStatusDTO
  ): Promise<PaymentResponse> {
    return prisma.$transaction(
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
          await transaction.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: 'PAID' },
          });

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
              paymentStatus: { not: 'PAID' },
            },
            data: { paymentStatus: 'PENDING' },
          });
        } else {
          await transaction.order.updateMany({
            where: {
              id: payment.orderId,
              paymentStatus: { not: 'PAID' },
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
    const order = await prisma.order.findUnique({
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

    const payments = await prisma.payment.findMany({
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
    const order = await prisma.order.findUnique({
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
      status: payment.status,
      ref: payment.ref,
      retryAvailable,
      ...(attempts ? { attempts } : {}),
    };
  }
}




