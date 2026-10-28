import {
  Body,
  Controller,
  Get,
  Patch,
  Path,
  Post,
  Route,
  Security,
  Tags,
  Request,
  SuccessResponse,
  Response,
} from 'tsoa';
import express from 'express';

import { CustomOrderService } from '../services/custom-order.service.js';
import {
  CreateCustomOrderRequest,
  CustomOrderResponse,
  CustomOrderData,
  UpdateCustomOrderStatusRequest,
  ProposeQuoteRequest,
  AcceptQuoteRequest,
} from '../interfaces/custom-order.interface.js';
import { AppError } from '../utils/appError.js';
import { getUser } from '../utils/getUser.js';

const customOrderService = new CustomOrderService();

@Route('custom-orders')
@Tags('Custom Orders')
export class CustomOrderController extends Controller {

  /** Submit a bespoke / custom order request */
  @Post()
  @SuccessResponse('201', 'Created')
  @Response(400, 'Bad Request')
  public async createCustomOrder(
    @Request() request: express.Request,
    @Body() requestBody: CreateCustomOrderRequest
  ): Promise<CustomOrderResponse> {
    const authorization = request.headers.authorization;

    let userId: string | null = null;

    if (authorization) {
      try {
        userId = getUser(request).userId;
      } catch {
        userId = null;
      }
    }

    const customOrder = await customOrderService.createCustomOrder(
      userId,
      requestBody
    );

    this.setStatus(201);

    return {
      success: true,
      message: 'Custom order request submitted successfully',
      data: customOrder,
    };
  }

  /** Get current customer's custom order requests */
  @Get('my')
  @Security('jwt')
  @SuccessResponse('200', 'Success')
  public async getMyCustomOrders(
    @Request() request: express.Request
  ): Promise<CustomOrderData[]> {
    return customOrderService.getMyCustomOrders(
      getUser(request).userId
    );
  }

  /** Get one custom order request â€” own request or Admin */
  @Get('{id}')
  @Security('jwt')
  @SuccessResponse('200', 'Success')
  @Response(403, 'Forbidden')
  @Response(404, 'Not Found')
  public async getCustomOrderById(
    @Request() request: express.Request,
    @Path() id: string
  ): Promise<CustomOrderData> {
    const user = getUser(request);

    return customOrderService.getCustomOrderById(
      id,
      user.userId,
      user.role === 'ADMIN'
    );
  }

  /** Get all custom order requests â€” Admin only */
  @Get()
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  public async getAllCustomOrders(): Promise<CustomOrderData[]> {
    return customOrderService.getAllCustomOrders();
  }

  /** Propose or resend a quote - Admin only */
  @Patch('{id}/quote')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Quote proposed')
  @Response(400, 'Invalid quote')
  @Response(404, 'Custom order not found')
  public async proposeCustomOrderQuote(
    @Path() id: string,
    @Body() requestBody: ProposeQuoteRequest
  ): Promise<CustomOrderData> {
    return customOrderService.proposeQuote(id, requestBody);
  }

  /** View a quote through its secure customer link */
  @Get('quote/{token}')
  @SuccessResponse('200', 'Quote retrieved')
  @Response(404, 'Quote link invalid or expired')
  public async getCustomerQuoteByToken(
    @Path() token: string
  ): Promise<{
    quoteReference: string | null;
    garmentType: string;
    quantity: number;
    quoteTotal: number | null;
    advanceAmount: number | null;
    deliveryFee: number | null;
    additionalCharges: number | null;
    balanceAmount: number | null;
    estimatedCompletionAt: Date | null;
    paymentTerms: string | null;
    quoteStatus: string;
  }> {
    const quote = await customOrderService.getQuoteByToken(token);

    return {
      quoteReference: quote.quoteReference,
      garmentType: quote.garmentType,
      quantity: quote.quantity,
      quoteTotal: quote.quoteTotal,
      advanceAmount: quote.advanceAmount,
      deliveryFee: quote.deliveryFee,
      additionalCharges: quote.additionalCharges,
      balanceAmount: quote.balanceAmount,
      estimatedCompletionAt: quote.estimatedCompletionAt,
      paymentTerms: quote.paymentTerms,
      quoteStatus: quote.quoteStatus,
    };
  }

  /** Accept or decline a quote using its one-time secure token */
  @Post('quote/{token}/decision')
  @SuccessResponse('200', 'Quote decision recorded')
  @Response(400, 'Invalid decision')
  @Response(410, 'Quote no longer available')
  public async decideCustomerQuote(
    @Path() token: string,
    @Body() requestBody: AcceptQuoteRequest
  ): Promise<{
    quoteReference: string | null;
    quoteStatus: string;
  }> {
    if (typeof requestBody?.accepted !== 'boolean') {
      throw new AppError('The accepted field must be true or false.', 400);
    }

    const quote = await customOrderService.decideQuoteByToken(
      token,
      requestBody.accepted
    );

    return {
      quoteReference: quote.quoteReference,
      quoteStatus: quote.quoteStatus,
    };
  }
  /** Update custom order status â€” Admin only */
  @Patch('{id}/status')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response(404, 'Not Found')
  public async updateCustomOrderStatus(
    @Path() id: string,
    @Body() requestBody: UpdateCustomOrderStatusRequest
  ): Promise<CustomOrderData> {
    return customOrderService.updateCustomOrderStatus(
      id,
      requestBody
    );
  }
}
