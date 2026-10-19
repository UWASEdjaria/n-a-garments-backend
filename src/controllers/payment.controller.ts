import {
  Body,
  Controller,
  Get,
  Path,
  Post,
  Put,
  Query,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { PaymentService } from '../services/payment.service.js';
import {
  initiateGuestPaymentSchema,
  initiatePaymentSchema,
  updatePaymentStatusSchema,
} from '../validators/payment.validator.js';
import {
  InitiateGuestPaymentDTO,
  InitiatePaymentDTO,
  UpdatePaymentStatusDTO,
  PaymentResponse,
} from '../interfaces/payment.interface.js';
import { getUser } from '../utils/getUser.js';
import { AppError } from '../utils/appError.js';

@Route('payments')
@Tags('Payments')
export class PaymentController extends Controller {
  private paymentService = new PaymentService();

  @Post('/initiate')
  @Security('jwt', ['CUSTOMER'])
  public async initiatePayment(
    @Request() request: express.Request,
    @Body() body: InitiatePaymentDTO
  ): Promise<PaymentResponse> {
    const user = getUser(request);
    const validatedData = initiatePaymentSchema.parse(body);

    return this.paymentService.initiatePayment(
      validatedData,
      user.userId
    );
  }

  @Post('/guest/initiate')
  @SuccessResponse('200', 'Success')
  @Response(400, 'Bad Request')
  @Response(404, 'Order not found')
  public async initiateGuestPayment(
    @Body() body: InitiateGuestPaymentDTO
  ): Promise<PaymentResponse> {
    const validatedData = initiateGuestPaymentSchema.parse(body);

    return this.paymentService.initiateGuestPayment(validatedData);
  }

  @Post('/webhook/paypack')
  public async handlePaypackWebhook(
    @Request() request: express.Request
  ): Promise<{ success: boolean }> {
    const body = request.body as {
      data?: { ref?: string; status?: string };
      ref?: string;
      status?: string;
    };
    const secret = process.env.PAYPACK_WEBHOOK_SIGN_KEY;

    if (!secret) {
      throw new AppError('Paypack webhook verification is not configured.', 503);
    }

    const rawBody = (
      request as express.Request & { rawBody?: Buffer }
    ).rawBody;
    const signature = request.header('x-paypack-signature');

    if (!rawBody || !signature) {
      throw new AppError('Missing Paypack webhook signature or request body.', 401);
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(rawBody)
      .digest();

    const receivedSignature = Buffer.from(signature, 'base64');

    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      throw new AppError('Invalid Paypack webhook signature.', 401);
    }

    const ref = body.data?.ref || body.ref;
    const status = body.data?.status || body.status;

    if (
      typeof ref !== 'string' ||
      !ref.trim() ||
      typeof status !== 'string' ||
      !status.trim()
    ) {
      throw new AppError('Invalid Paypack webhook payload.', 400);
    }

    await this.paymentService.handlePaypackWebhook({ ref, status });

    return { success: true };
  }
  @Get('/order/{orderId}')
  @Security('jwt', ['CUSTOMER'])
  public async getPaymentByOrderId(
    @Request() request: express.Request,
    @Path() orderId: string
  ): Promise<PaymentResponse> {
    const user = getUser(request);

    return this.paymentService.getPaymentByOrderId(
      orderId,
      user.userId
    );
  }

  @Get('/guest/order/{orderId}')
  @Response(404, 'Payment not found for this order')
  public async getGuestPaymentByOrderId(
    @Path() orderId: string,
    @Query() email: string
  ): Promise<PaymentResponse> {
    return this.paymentService.getGuestPaymentByOrderId(orderId, email);
  }

  @Put('/{id}/status')
  @Security('jwt', ['ADMIN'])
  public async updateStatus(
    @Path() id: string,
    @Body() body: UpdatePaymentStatusDTO
  ): Promise<PaymentResponse> {
    const validatedData = updatePaymentStatusSchema.parse(body);

    return this.paymentService.updatePaymentStatus(id, validatedData);
  }
}

