import { Body, Controller, Get, Path, Post, Put, Route, Security, Tags } from 'tsoa';
import { PaymentService } from '../services/payment.service';
import { initiatePaymentSchema, updatePaymentStatusSchema } from '../validators/payment.validator';
import { InitiatePaymentDTO, UpdatePaymentStatusDTO, PaymentResponse } from '../interfaces/payment.interface';

@Route('payments')
@Tags('Payments')
export class PaymentController extends Controller {
  private paymentService = new PaymentService();

  @Post('/initiate')
  @Security('jwt')
  public async initiatePayment(@Body() body: InitiatePaymentDTO): Promise<PaymentResponse> {
    const validatedData = initiatePaymentSchema.parse(body);
    return this.paymentService.initiatePayment(validatedData);
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