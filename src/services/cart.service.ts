import { PrismaClient } from '@prisma/client';
import { AddCartItemRequest, UpdateCartItemRequest, CartResponse } from '../interfaces/cart.interface';
import { AppError } from '../utils/appError';

const prisma = new PrismaClient();

export class CartService {

  private async getOrCreateCart(userId: string) {
    let cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    if (!cart) cart = await prisma.cart.create({ data: { userId }, include: { items: true } });
    return cart;
  }

  async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId);
    return { success: true, message: 'Cart retrieved successfully', data: cart };
  }

  async addItem(userId: string, body: AddCartItemRequest): Promise<CartResponse> {
    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) throw new AppError('Product not found', 404);
    if (!product.isAvailable) throw new AppError('Product is not available', 400);
    if (product.stockQuantity < body.quantity) throw new AppError('Insufficient stock', 400);

    const cart = await this.getOrCreateCart(userId);

    const existing = cart.items.find(
      (i) => i.productId === body.productId && i.size === (body.size ?? null) && i.color === (body.color ?? null)
    );

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + body.quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: body.productId,
          quantity: body.quantity,
          size: body.size ?? null,
          color: body.color ?? null,
        },
      });
    }

    const updated = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    return { success: true, message: 'Item added to cart', data: updated! };
  }

  async updateItem(userId: string, itemId: string, body: UpdateCartItemRequest): Promise<CartResponse> {
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: { cart: true },
    });

    if (!item) throw new AppError('Cart item not found', 404);

    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: body.quantity } });

    const updated = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    return { success: true, message: 'Cart item updated', data: updated! };
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponse> {
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: { cart: true },
    });

    if (!item) throw new AppError('Cart item not found', 404);

    await prisma.cartItem.delete({ where: { id: itemId } });

    const updated = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    return { success: true, message: 'Item removed from cart', data: updated! };
  }

  async clearCart(userId: string): Promise<{ success: boolean; message: string }> {
    const cart = await this.getOrCreateCart(userId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { success: true, message: 'Cart cleared' };
  }
}
