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
  initiateCustomQuotePaymentSchema,
  initiatePaymentSchema,
  updatePaymentStatusSchema,
} from '../validators/payment.validator.js';
import {
  InitiateGuestPaymentDTO,
  InitiatePaymentDTO,
  UpdatePaymentStatusDTO,
  PaymentResponse,
  InitiateCustomQuotePaymentDTO,
  CustomQuotePaymentResponse,
  CustomQuotePaymentStatusResponse,
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

  @Post('/custom-quote/{token}/initiate')
  @SuccessResponse('200', 'Payment initiated')
  @Response(400, 'Invalid payment details')
  @Response(404, 'Quote link not found or expired')
  @Response(409, 'Quote not accepted or payment already pending')
  public async initiateCustomQuotePayment(
    @Path() token: string,
    @Body() body: InitiateCustomQuotePaymentDTO
  ): Promise<CustomQuotePaymentResponse> {
    const validatedData = initiateCustomQuotePaymentSchema.parse(body);

    return this.paymentService.initiateCustomQuotePayment(
      token,
      validatedData
    );
  }

  @Get('/custom-quote/{token}')
  @Response(404, 'Quote link not found or expired')
  public async getCustomQuotePaymentStatus(
    @Path() token: string
  ): Promise<CustomQuotePaymentStatusResponse> {
    return this.paymentService.getCustomQuotePaymentStatus(token);
  }
  @Post('/webhook/paypal')
  public async handlePaypalWebhook(
    @Request() request: express.Request
  ): Promise<{ reply: string }> {
    const rawBody =
      (request as express.Request & { rawBody?: Buffer }).rawBody ??
      Buffer.alloc(0);

    await this.paymentService.handlePaypalWebhook(
      request.body,
      rawBody,
      {
        transmissionId: request.header('paypal-transmission-id'),
        transmissionTime: request.header('paypal-transmission-time'),
        certUrl: request.header('paypal-cert-url'),
        authAlgo: request.header('paypal-auth-algo'),
        transmissionSig: request.header('paypal-transmission-sig'),
      }
    );

    return { reply: 'OK' };
  }
  @Post('/webhook/paypack')
  public async handlePaypackWebhook(
    @Request() request: express.Request
  ): Promise<{ reply: string }> {
    const rawBody =
      (request as express.Request & { rawBody?: Buffer }).rawBody ??
      Buffer.alloc(0);

    await this.paymentService.handlePaypackWebhook(
      request.body,
      rawBody,
      request.header('x-paypack-signature'),
      request.header('x-webhook-mode')
    );

    return { reply: 'OK' };
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



