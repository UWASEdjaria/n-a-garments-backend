import { PrismaClient } from '@prisma/client';
import {
  CreateCustomOrderRequest,
  CustomOrderData,
  UpdateCustomOrderStatusRequest,
} from '../interfaces/custom-order.interface.js';
import { AppError } from '../utils/appError.js';
import { sendCustomOrderEmail } from '../utils/email.js';


const prisma = new PrismaClient();

export class CustomOrderService {
  private formatCustomOrder(order: CustomOrderData): CustomOrderData {
    return order;
  }

  async createCustomOrder(
    userId: string | null,
    body: CreateCustomOrderRequest
  ): Promise<CustomOrderData> {
    if (!body.name?.trim()) {
      throw new AppError('Name is required', 400);
    }

    if (!body.email?.trim()) {
      throw new AppError('Email is required', 400);
    }

    if (!body.phone?.trim()) {
      throw new AppError('Phone number is required', 400);
    }

    if (!body.garmentType?.trim()) {
      throw new AppError('Garment type is required', 400);
    }

    if (!body.quantity || body.quantity < 1) {
      throw new AppError('Quantity must be at least 1', 400);
    }

    if (!body.description?.trim()) {
      throw new AppError('Description is required', 400);
    }

    const customOrder = await prisma.customOrder.create({
      data: {
        userId,
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
        garmentType: body.garmentType.trim(),
        quantity: body.quantity,
        measurements: body.measurements?.trim() || null,
        description: body.description.trim(),
        additionalReqs: body.additionalReqs?.trim() || null,
        referenceImageUrls: body.referenceImageUrls ?? [],
      },
    });

    try {
      await sendCustomOrderEmail(
        customOrder.name,
        customOrder.email,
        customOrder.phone,
        customOrder.garmentType,
        customOrder.quantity,
        customOrder.measurements ?? undefined,
        customOrder.description,
        customOrder.additionalReqs ?? undefined,
        customOrder.referenceImageUrls
      );
    } catch (error) {
      console.error(
        'Custom order saved, but email notification failed:',
        error
      );
    }

    return this.formatCustomOrder(customOrder);
  }

  async getMyCustomOrders(userId: string): Promise<CustomOrderData[]> {
    const orders = await prisma.customOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.formatCustomOrder(order));
  }

  async getCustomOrderById(
    id: string,
    userId: string,
    isAdmin: boolean
  ): Promise<CustomOrderData> {
    const order = await prisma.customOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new AppError('Custom order not found', 404);
    }

    if (!isAdmin && order.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return this.formatCustomOrder(order);
  }

  async getAllCustomOrders(): Promise<CustomOrderData[]> {
    const orders = await prisma.customOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.formatCustomOrder(order));
  }

  async updateCustomOrderStatus(
    id: string,
    body: UpdateCustomOrderStatusRequest
  ): Promise<CustomOrderData> {
    const existingOrder = await prisma.customOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new AppError('Custom order not found', 404);
    }

    const updatedOrder = await prisma.customOrder.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.adminNotes !== undefined && {
          adminNotes: body.adminNotes.trim() || null,
        }),
      },
    });

    return this.formatCustomOrder(updatedOrder);
  }
}