import { Prisma, PrismaClient } from '@prisma/client';
import { AddCartItemRequest, UpdateCartItemRequest, CartResponse, CartData } from '../interfaces/cart.interface.js';
import { AppError } from '../utils/appError.js';
import { NotificationService } from './notification.service.js';

const prisma = new PrismaClient();
const notificationService = new NotificationService();

const itemInclude = { product: { include: { images: true } } } as const;

type CartWithItems = Prisma.CartGetPayload<{ include: { items: { include: typeof itemInclude } } }>;

function formatCart(cart: CartWithItems): CartData {
  return {
    id: cart.id,
    userId: cart.userId,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    items: cart.items.map((item) => ({
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        description: item.product.description,
        price: Number(item.product.price),
        stockQuantity: item.product.stockQuantity,
        minimumStockLevel: item.product.minimumStockLevel,
        maximumStockLevel: item.product.maximumStockLevel,
        isAvailable: item.product.isAvailable,
        productType: item.product.productType as string,
        sizes: item.product.sizes,
        colors: item.product.colors,
        images: item.product.images,
        categoryId: item.product.categoryId,
        createdAt: item.product.createdAt,
        updatedAt: item.product.updatedAt,
      },
    })),
  };
}

export class CartService {

  private async getOrCreateCart(userId: string): Promise<CartWithItems> {
    let cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: itemInclude } } });
    if (!cart) cart = await prisma.cart.create({ data: { userId }, include: { items: { include: itemInclude } } });
    return cart;
  }

  async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId);
    return { success: true, message: 'Cart retrieved successfully', data: formatCart(cart) };
  }

  async addItem(userId: string, body: AddCartItemRequest): Promise<CartResponse> {
    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) throw new AppError('Product not found', 404);
    if (product.productType !== 'READY_TO_WEAR') throw new AppError('Only ready-to-wear products can be added to cart', 400);
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

    const updated = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: itemInclude } } });

    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      await notificationService.createNotification({
        type: 'CART_ACTIVITY',
        title: 'Customer added to cart',
        message: `${user?.name ?? 'A customer'} added ${body.quantity} item(s) to their cart.`,
        resourceType: 'CART',
        resourceId: updated?.id ?? cart.id,
        actorName: user?.name ?? null,
        actorEmail: user?.email ?? null,
      });
    } catch (error) {
      console.error('Failed to create admin notification for cart activity:', error);
    }

    return { success: true, message: 'Item added to cart', data: formatCart(updated!) };
  }

  async updateItem(userId: string, itemId: string, body: UpdateCartItemRequest): Promise<CartResponse> {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { cart: true, product: true },
    });

    if (!item) throw new AppError('Cart item not found', 404);
    if (item.product.productType !== 'READY_TO_WEAR') throw new AppError('Only ready-to-wear products can be in cart', 400);
    if (item.product.stockQuantity < body.quantity) throw new AppError('Insufficient stock', 400);

    const updated = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: itemInclude } } });
    return { success: true, message: 'Cart item updated', data: formatCart(updated!) };
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponse> {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { cart: true },
    });

    if (!item) throw new AppError('Cart item not found', 404);

    await prisma.cartItem.delete({ where: { id: itemId } });

    const updated = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: itemInclude } } });
    return { success: true, message: 'Item removed from cart', data: formatCart(updated!) };
  }

  async clearCart(userId: string): Promise<{ success: boolean; message: string }> {
    const cart = await this.getOrCreateCart(userId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { success: true, message: 'Cart cleared' };
  }
}
