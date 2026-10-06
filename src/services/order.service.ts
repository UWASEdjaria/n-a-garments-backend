import { Prisma, PrismaClient } from '@prisma/client';
import { OrderData, GuestPlaceOrderRequest, PlaceOrderRequest, UpdateOrderStatusRequest, OrderResponse, OrderListResponse } from '../interfaces/order.interface.js';
import { AppError } from '../utils/appError.js';

const prisma = new PrismaClient();

export class OrderService {

  private formatOrder(order: Prisma.OrderGetPayload<{ include: { items: true } }>): OrderData {
    return {
      ...order,
      totalAmount: Number(order.totalAmount),
      items: order.items.map((item) => ({ ...item, purchasePrice: Number(item.purchasePrice) })),
    };
  }

  async placeOrder(userId: string, body: PlaceOrderRequest): Promise<OrderResponse> {
    if (!body.shippingAddr?.trim()) throw new AppError('Shipping address is required', 400);

    const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: { product: true } } } });
    if (!cart || cart.items.length === 0) throw new AppError('Your cart is empty', 400);

    for (const item of cart.items) {
      if (!item.product.isAvailable) throw new AppError(`Product "${item.product.name}" is no longer available`, 400);
      if (item.product.stockQuantity < item.quantity) throw new AppError(`Insufficient stock for "${item.product.name}"`, 400);
    }

    const totalAmount = cart.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          shippingAddr: body.shippingAddr.trim(),
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              purchasePrice: item.product.price,
              size: item.size,
              color: item.color,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    return { success: true, message: 'Order placed successfully', data: this.formatOrder(order) };
  }

  async placeGuestOrder(body: GuestPlaceOrderRequest): Promise<OrderResponse> {
    const productIds = [...new Set(body.items.map((item) => item.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((product) => [product.id, product]));

    if (productById.size !== productIds.length) {
      throw new AppError('One or more products were not found', 404);
    }

    const quantitiesByProduct = new Map<string, number>();
    for (const item of body.items) {
      quantitiesByProduct.set(
        item.productId,
        (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    for (const [productId, quantity] of quantitiesByProduct) {
      const product = productById.get(productId);
      if (!product) throw new AppError('One or more products were not found', 404);
      if (!product.isAvailable) throw new AppError(`Product "${product.name}" is no longer available`, 400);
      if (product.stockQuantity < quantity) throw new AppError(`Insufficient stock for "${product.name}"`, 400);
    }

    const orderItems = body.items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) throw new AppError('One or more products were not found', 404);
      return {
        productId: item.productId,
        quantity: item.quantity,
        purchasePrice: product.price,
        size: item.size ?? null,
        color: item.color ?? null,
      };
    });
    const totalAmount = orderItems.reduce((sum, item) => {
      const product = productById.get(item.productId);
      if (!product) throw new AppError('One or more products were not found', 404);
      return sum + Number(product.price) * item.quantity;
    }, 0);

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: null,
          guestName: body.name.trim(),
          guestEmail: body.email.trim().toLowerCase(),
          guestPhone: body.phone?.trim() ?? null,
          totalAmount,
          shippingAddr: body.shippingAddr.trim(),
          items: { create: orderItems },
        },
        include: { items: true },
      });

      for (const [productId, quantity] of quantitiesByProduct) {
        await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: { decrement: quantity } },
        });
      }

      return newOrder;
    });

    return { success: true, message: 'Guest order placed successfully', data: this.formatOrder(order) };
  }

  async getMyOrders(userId: string, page = 1, limit = 10): Promise<OrderListResponse> {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where: { userId }, include: { items: true }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.order.count({ where: { userId } }),
    ]);
    return { success: true, message: 'Orders retrieved successfully', data: orders.map(this.formatOrder), totalPages: Math.ceil(total / limit) };
  }

  async getOrderById(userId: string, orderId: string, role: string): Promise<OrderResponse> {
    let order;

    if (role === 'ADMIN') {
      order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    } else {
      order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId,
        },
        include: { items: true },
      });
    }

    if (!order) throw new AppError('Order not found', 404);
    if (role !== 'ADMIN' && order.userId !== userId) throw new AppError('Access denied', 403);
    return { success: true, message: 'Order retrieved successfully', data: this.formatOrder(order) };
  }

  async getAllOrders(page = 1, limit = 10): Promise<OrderListResponse> {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.order.count(),
    ]);
    return { success: true, message: 'Orders retrieved successfully', data: orders.map(this.formatOrder), totalPages: Math.ceil(total / limit) };
  }

  async updateOrderStatus(orderId: string, body: UpdateOrderStatusRequest): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404);
    const updated = await prisma.order.update({ where: { id: orderId }, data: { status: body.status }, include: { items: true } });
    return { success: true, message: 'Order status updated', data: this.formatOrder(updated) };
  }
}
