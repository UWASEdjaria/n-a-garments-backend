import { Controller, Route, Get, Post, Patch, Body, Path, Query, Tags, Security, Request, SuccessResponse, Response } from 'tsoa';
import express from 'express';
import { OrderService } from '../services/order.service';
import { PlaceOrderRequest, UpdateOrderStatusRequest, OrderResponse, OrderListResponse } from '../interfaces/order.interface';
import { JwtPayload } from '../config/jwt';

const orderService = new OrderService();

@Route('orders')
@Tags('Orders')
@Security('jwt')
export class OrderController extends Controller {

  /** Place a new order from current cart — Customer */
  @Post()
  @SuccessResponse('201', 'Created')
  @Response(400, 'Bad Request')
  public async placeOrder(@Request() request: express.Request, @Body() requestBody: PlaceOrderRequest): Promise<OrderResponse> {
    const user = (request as any).user as JwtPayload;
    const result = await orderService.placeOrder(user.userId, requestBody);
    this.setStatus(201);
    return result;
  }

  /** Get current user's orders — Customer */
  @Get('my')
  @SuccessResponse('200', 'Success')
  public async getMyOrders(
    @Request() request: express.Request,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<OrderListResponse> {
    const user = (request as any).user as JwtPayload;
    return orderService.getMyOrders(user.userId, page, limit);
  }

  /** Get a single order by ID — Customer (own) or Admin */
  @Get('{orderId}')
  @SuccessResponse('200', 'Success')
  @Response(403, 'Forbidden')
  @Response(404, 'Not Found')
  public async getOrderById(@Request() request: express.Request, @Path() orderId: string): Promise<OrderResponse> {
    const user = (request as any).user as JwtPayload;
    return orderService.getOrderById(user.userId, orderId, user.role);
  }

  /** Get all orders — Admin only */
  @Get()
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  public async getAllOrders(@Query() page?: number, @Query() limit?: number): Promise<OrderListResponse> {
    return orderService.getAllOrders(page, limit);
  }

  /** Update order status — Admin only */
  @Patch('{orderId}/status')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response(404, 'Not Found')
  public async updateOrderStatus(@Path() orderId: string, @Body() requestBody: UpdateOrderStatusRequest): Promise<OrderResponse> {
    return orderService.updateOrderStatus(orderId, requestBody);
  }
}
