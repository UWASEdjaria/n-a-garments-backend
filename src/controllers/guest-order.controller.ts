import { Body, Controller, Post, Request, Response, Route, SuccessResponse, Tags } from 'tsoa';
import express from 'express';
import { GuestPlaceOrderRequest, OrderResponse } from '../interfaces/order.interface.js';
import { OrderService } from '../services/order.service.js';
import { guestPlaceOrderSchema } from '../validators/guest-order.validator.js';

const orderService = new OrderService();

@Route('orders/guest')
@Tags('Orders')
export class GuestOrderController extends Controller {
  @Post()
  @SuccessResponse('201', 'Created')
  @Response(400, 'Bad Request')
  @Response(404, 'Product not found')
  public async placeGuestOrder(
    @Request() _request: express.Request,
    @Body() requestBody: GuestPlaceOrderRequest,
  ): Promise<OrderResponse> {
    const validatedBody = guestPlaceOrderSchema.parse(requestBody);
    const result = await orderService.placeGuestOrder(validatedBody);
    this.setStatus(201);
    return result;
  }
}