import { randomUUID } from 'node:crypto';
import { PrismaClient, type Payment, type Prisma } from '@prisma/client';
import { InitiateGuestPaymentDTO, InitiatePaymentDTO, UpdatePaymentStatusDTO, PaymentResponse, PaymentAttemptSummary } from '../interfaces/payment.interface';
import { AppError } from '../utils/appError';
import { PaypackRequestError, PaypackService } from './paypack.service';

const prisma = new PrismaClient();
const configuredPendingMinutes = Number.parseInt(process.env.PAYMENT_PENDING_TIMEOUT_MINUTES || '15', 10);
const pendingTimeoutMinutes = Number.isFinite(configuredPendingMinutes) && configuredPendingMinutes > 0
  ? configuredPendingMinutes
  : 15;

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

const isRetryEligible = (payment: Pick<Payment, 'status' | 'createdAt'>, now = Date.now()): boolean => {
  if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
    return true;
  }

  return payment.status === 'PENDING'
    && now - payment.createdAt.getTime() >= pendingTimeoutMinutes * 60_000;
};

export class PaymentService {
  private paypackService = new PaypackService();

  public async initiateGuestPayment(data: InitiateGuestPaymentDTO): Promise<PaymentResponse> {
    const { email, ...paymentData } = data;
    return this.initiatePayment(paymentData, email);
  }

  public async initiatePayment(data: InitiatePaymentDTO, guestEmail?: string): Promise<PaymentResponse> {
    if (data.paymentMethod === 'MOMO' && !data.phoneNumber) {
      throw new AppError('Phone number is required for Mobile Money payments.', 400);
    }

    let payment: Payment;
    try {
      payment = await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
        const order = await transaction.order.findUnique({ where: { id: data.orderId } });
        if (!order) {
          throw new AppError('Order not found.', 404);
        }

        if (guestEmail !== undefined) {
          if (order.userId !== null || order.guestEmail?.toLowerCase() !== guestEmail.trim().toLowerCase()) {
            throw new AppError('Order not found.', 404);
          }
        } else if (order.userId === null) {
          throw new AppError('Order not found.', 404);
        }

        if (Number(order.totalAmount) !== data.amount) {
          throw new AppError('Payment amount must match the order total.', 400);
        }

        const successfulAttempt = await transaction.payment.findFirst({
          where: { orderId: order.id, status: { in: ['PAID', 'SUCCESSFUL'] } },
        });
        if (order.paymentStatus === 'PAID' || successfulAttempt) {
          throw new AppError('This order has already been paid.', 409);
        }

        const pendingAttempt = await transaction.payment.findFirst({
          where: { orderId: order.id, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
        if (pendingAttempt && !isRetryEligible(pendingAttempt)) {
          throw new AppError('A payment attempt is already pending. Check its status before retrying.', 409);
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
            phoneNumber: data.phoneNumber ? formatRwandaPhone(data.phoneNumber) : null,
          },
        });

        await transaction.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PENDING' },
        });
        return attempt;
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const activeAttempt = await prisma.payment.findFirst({
        where: { orderId: data.orderId, status: 'PENDING' },
      });
      if (activeAttempt) {
        throw new AppError('A payment attempt is already in progress.', 409);
      }
      throw error;
    }

    if (data.paymentMethod === 'MOMO') {
      try {
        const paypackResult = await this.paypackService.cashIn(payment.phoneNumber!, payment.amount.toNumber());
        payment = await prisma.payment.update({
          where: { id: payment.id },
          data: { ref: paypackResult.ref },
        });
      } catch (error) {
        if (error instanceof PaypackRequestError && error.definitivelyRejected) {
          await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
            await transaction.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
            await transaction.order.updateMany({
              where: {
                id: payment.orderId,
                paymentStatus: { not: 'PAID' },
                payments: { none: { status: 'PENDING' } },
              },
              data: { paymentStatus: 'FAILED' },
            });
          });
        }
        throw error;
      }
    } else if (data.paymentMethod === 'CASH_ON_DELIVERY' || data.paymentMethod === 'CARD') {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { ref: `${data.paymentMethod === 'CARD' ? 'CARD' : 'COD'}-${randomUUID()}` },
      });
    }

    const message = data.paymentMethod === 'CASH_ON_DELIVERY'
      ? 'Cash on Delivery selected. Payment will be collected upon delivery.'
      : data.paymentMethod === 'MOMO'
        ? 'Mobile Money prompt sent to user phone. Please approve the prompt.'
        : 'Card payment initialized.';

    return this.toResponse(payment, message, false);
  }

  public async handlePaypackWebhook(payload: { ref: string; status: string }): Promise<void> {
    const webhookStatus = payload.status.toLowerCase();
    const isSuccess = ['successful', 'completed', 'paid'].includes(webhookStatus);
    const failureStatus = webhookStatus === 'cancelled'
      ? 'CANCELLED'
      : ['failed', 'failure'].includes(webhookStatus)
        ? 'FAILED'
        : null;

    if (!isSuccess && !failureStatus) {
      return;
    }

    await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      const payment = await transaction.payment.findUnique({ where: { ref: payload.ref } });
      if (!payment) {
        console.warn(`Paypack webhook received for unknown reference: ${payload.ref}`);
        return;
      }
      if (payment.status === 'PAID' || payment.status === 'SUCCESSFUL') {
        return;
      }

      if (isSuccess) {
        const orderUpdate = await transaction.order.updateMany({
          where: { id: payment.orderId, paymentStatus: { not: 'PAID' } },
          data: { paymentStatus: 'PAID' },
        });
        await transaction.payment.updateMany({
          where: { id: payment.id, status: { notIn: ['PAID', 'SUCCESSFUL'] } },
          data: { status: orderUpdate.count === 1 ? 'PAID' : 'SUCCESSFUL' },
        });

        if (orderUpdate.count === 1) {
          await transaction.payment.updateMany({
            where: { orderId: payment.orderId, id: { not: payment.id }, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          });
        }

        if (orderUpdate.count === 0) {
          console.error(`Paypack reported a second successful attempt for already-paid order ${payment.orderId}; reference ${payload.ref} requires reconciliation.`);
        }
        return;
      }

      if (!failureStatus) {
        return;
      }

      await transaction.payment.updateMany({
        where: { id: payment.id, status: { notIn: ['PAID', 'SUCCESSFUL'] } },
        data: { status: failureStatus },
      });
      await transaction.order.updateMany({
        where: {
          id: payment.orderId,
          paymentStatus: { not: 'PAID' },
          payments: { none: { status: 'PENDING' } },
        },
        data: { paymentStatus: failureStatus },
      });
    });
  }

  public async updatePaymentStatus(paymentId: string, dto: UpdatePaymentStatusDTO): Promise<PaymentResponse> {
    return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      const payment = await transaction.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        throw new AppError('Payment record not found.', 404);
      }

      if (dto.status === 'PAID' || dto.status === 'SUCCESSFUL') {
        const otherSuccessfulAttempt = await transaction.payment.findFirst({
          where: {
            orderId: payment.orderId,
            id: { not: payment.id },
            status: { in: ['PAID', 'SUCCESSFUL'] },
          },
        });
        if (otherSuccessfulAttempt) {
          throw new AppError('Another payment attempt has already succeeded for this order.', 409);
        }
      }

      const updated = await transaction.payment.update({
        where: { id: paymentId },
        data: { status: dto.status },
      });

      if (dto.status === 'PAID' || dto.status === 'SUCCESSFUL') {
        await transaction.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'PAID' } });
        await transaction.payment.updateMany({
          where: { orderId: payment.orderId, id: { not: payment.id }, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      } else if (dto.status === 'PENDING') {
        await transaction.order.updateMany({
          where: { id: payment.orderId, paymentStatus: { not: 'PAID' } },
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

      return this.toResponse(updated, `Payment status updated to ${dto.status}`, isRetryEligible(updated));
    });
  }

  public async getPaymentByOrderId(orderId: string): Promise<PaymentResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true },
    });
    if (!order) {
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

    const hasSuccessfulAttempt = payments.some((attempt) => ['PAID', 'SUCCESSFUL'].includes(attempt.status));
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
        order.paymentStatus !== 'PAID' && !hasSuccessfulAttempt && isRetryEligible(payment),
        attempts
      ),
    };
  }

  public async getGuestPaymentByOrderId(orderId: string, email: string): Promise<PaymentResponse> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, guestEmail: true },
    });
    if (
      !order
      || order.userId !== null
      || order.guestEmail?.toLowerCase() !== email.trim().toLowerCase()
    ) {
      throw new AppError('Payment not found for this order.', 404);
    }

    return this.getPaymentByOrderId(orderId);
  }

  private toResponse(payment: Payment, message: string, retryAvailable: boolean): PaymentResponse {
    return {
      success: true,
      message,
      data: this.paymentData(payment, retryAvailable),
    };
  }

  private paymentData(
    payment: Payment,
    retryAvailable: boolean,
    attempts?: PaymentAttemptSummary[]
  ): PaymentResponse['data'] {
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