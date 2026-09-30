import { PrismaClient } from '@prisma/client';
import { InitiatePaymentDTO, UpdatePaymentStatusDTO, PaymentResponse } from '../interfaces/payment.interface';
import { AppError } from '../utils/appError';
import { PaypackService } from './paypack.service';

const prisma = new PrismaClient();

export class PaymentService {
  private paypackService = new PaypackService();

  public async initiatePayment(data: InitiatePaymentDTO): Promise<PaymentResponse> {
    const existingPayment = await prisma.payment.findUnique({
      where: { orderId: data.orderId },
    });

    if (existingPayment) {
      throw new AppError('Payment has already been initiated for this order.', 409);
    }

    // 1. CASH ON DELIVERY WORKFLOW
    if (data.paymentMethod === 'CASH_ON_DELIVERY') {
      const payment = await prisma.payment.create({
        data: {
          orderId: data.orderId,
          amount: data.amount,
          paymentMethod: 'CASH_ON_DELIVERY',
          status: 'PENDING',
          ref: `COD-${data.orderId.slice(0, 8)}-${Date.now()}`,
          phoneNumber: data.phoneNumber || null,
        },
      });

      return {
        success: true,
        message: 'Cash on Delivery selected. Payment will be collected upon delivery.',
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          amount: Number(payment.amount),
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          ref: payment.ref,
        },
      };
    }

    // 2. MOBILE MONEY (PAYPACK) WORKFLOW
    if (data.paymentMethod === 'MOMO') {
      if (!data.phoneNumber) {
        throw new AppError('Phone number is required for Mobile Money payments.', 400);
      }

      // Initiate Paypack Cash-In Prompt
      const paypackResult = await this.paypackService.cashIn(data.phoneNumber, data.amount);

      const payment = await prisma.payment.create({
        data: {
          orderId: data.orderId,
          amount: data.amount,
          paymentMethod: 'MOMO',
          status: 'PENDING',
          ref: paypackResult.ref,
          phoneNumber: data.phoneNumber,
        },
      });

      return {
        success: true,
        message: 'Mobile Money prompt sent to user phone. Please approve the prompt.',
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          amount: Number(payment.amount),
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          ref: payment.ref,
        },
      };
    }

    // 3. CARD WORKFLOW
    const payment = await prisma.payment.create({
      data: {
        orderId: data.orderId,
        amount: data.amount,
        paymentMethod: 'CARD',
        status: 'PENDING',
        ref: `CARD-${Date.now()}`,
        phoneNumber: data.phoneNumber || null,
      },
    });

    return {
      success: true,
      message: 'Card payment initialized.',
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        ref: payment.ref,
      },
    };
  }

  // Handle Paypack Webhook Callbacks
  public async handlePaypackWebhook(payload: { ref: string; status: string }): Promise<void> {
    const payment = await prisma.payment.findUnique({ where: { ref: payload.ref } });

    if (!payment) {
      console.warn(`Paypack webhook received for unknown reference: ${payload.ref}`);
      return;
    }

    let updatedStatus: 'PAID' | 'SUCCESSFUL' | 'FAILED' = 'FAILED';
    if (payload.status === 'successful' || payload.status === 'completed') {
      updatedStatus = 'PAID';
    }

    await prisma.payment.update({
      where: { ref: payload.ref },
      data: { status: updatedStatus },
    });
  }

  public async updatePaymentStatus(paymentId: string, dto: UpdatePaymentStatusDTO): Promise<PaymentResponse> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      throw new AppError('Payment record not found.', 404);
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: dto.status },
    });

    return {
      success: true,
      message: `Payment status updated to ${dto.status}`,
      data: {
        paymentId: updated.id,
        orderId: updated.orderId,
        amount: Number(updated.amount),
        paymentMethod: updated.paymentMethod,
        status: updated.status,
        ref: updated.ref,
      },
    };
  }

  public async getPaymentByOrderId(orderId: string): Promise<PaymentResponse> {
    const payment = await prisma.payment.findUnique({ where: { orderId } });

    if (!payment) {
      throw new AppError('Payment not found for this order.', 404);
    }

    return {
      success: true,
      message: 'Payment record retrieved successfully',
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        ref: payment.ref,
      },
    };
  }
}