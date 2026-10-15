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
} from '../interfaces/custom-order.interface.js';
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

  /** Get one custom order request — own request or Admin */
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

  /** Get all custom order requests — Admin only */
  @Get()
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  public async getAllCustomOrders(): Promise<CustomOrderData[]> {
    return customOrderService.getAllCustomOrders();
  }

  /** Update custom order status — Admin only */
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