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

  @Post('/webhook/kpay')
  public async handleKpayWebhook(
    @Request() request: express.Request
  ): Promise<{ refid: string; reply: string }> {
    const body = request.body as {
      tid?: unknown;
      refid?: unknown;
      statusid?: unknown;
    };

    const refid =
      typeof body.refid === 'string' ? body.refid.trim() : '';

    const statusid =
      typeof body.statusid === 'string'
        ? body.statusid.trim()
        : typeof body.statusid === 'number' &&
            Number.isInteger(body.statusid)
          ? String(body.statusid).padStart(2, '0')
          : '';

    if (!refid || !['01', '02', '03'].includes(statusid)) {
      throw new AppError('Invalid K-Pay callback payload.', 400);
    }

    await this.paymentService.handleKpayWebhook({ refid, statusid });

    return { refid, reply: 'OK' };
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



