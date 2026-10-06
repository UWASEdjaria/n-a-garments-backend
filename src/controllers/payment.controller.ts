import { Body, Controller, Get, Path, Post, Put, Query, Response, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { PaymentService } from '../services/payment.service';
import { initiateGuestPaymentSchema, initiatePaymentSchema, updatePaymentStatusSchema } from '../validators/payment.validator';
import { InitiateGuestPaymentDTO, InitiatePaymentDTO, UpdatePaymentStatusDTO, PaymentResponse } from '../interfaces/payment.interface';

@Route('payments')
@Tags('Payments')
export class PaymentController extends Controller {
  private paymentService = new PaymentService();

  @Post('/initiate')
  @Security('jwt')
  public async initiatePayment(@Body() body: InitiatePaymentDTO): Promise<PaymentResponse> {
    try {
      const validatedData = initiatePaymentSchema.parse(body);
      return await this.paymentService.initiatePayment(validatedData);
    } catch (error) {
      console.error('[Payment] Initiation failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  @Post('/guest/initiate')
  @SuccessResponse('200', 'Success')
  @Response(400, 'Bad Request')
  @Response(404, 'Order not found')
  public async initiateGuestPayment(@Body() body: InitiateGuestPaymentDTO): Promise<PaymentResponse> {
    const validatedData = initiateGuestPaymentSchema.parse(body);
    return this.paymentService.initiateGuestPayment(validatedData);
  }

  @Post('/webhook/paypack')
  public async handlePaypackWebhook(@Body() body: { data?: { ref: string; status: string }; ref?: string; status?: string }): Promise<{ success: boolean }> {
    const ref = body.data?.ref || body.ref;
    const status = body.data?.status || body.status;

    if (ref && status) {
      await this.paymentService.handlePaypackWebhook({ ref, status });
    }

    return { success: true };
  }

  @Get('/order/{orderId}')
  @Security('jwt')
  public async getPaymentByOrderId(@Path() orderId: string): Promise<PaymentResponse> {
    return this.paymentService.getPaymentByOrderId(orderId);
  }

  @Get('/guest/order/{orderId}')
  @Response(404, 'Payment not found for this order')
  public async getGuestPaymentByOrderId(
    @Path() orderId: string,
    @Query() email: string,
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