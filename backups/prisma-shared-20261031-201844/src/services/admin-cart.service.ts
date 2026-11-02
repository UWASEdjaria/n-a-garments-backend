import { PrismaClient } from '@prisma/client';
import type {
  AdminCart,
  AdminCartItem,
  AdminCartListResponse,
} from '../interfaces/admin-cart.interface.js';

const prisma = new PrismaClient();

export class AdminCartService {
  async getAllCarts(): Promise<AdminCartListResponse> {
    const users = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        cart: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const data: AdminCart[] = users.map((user) => {
      const cart = user.cart;

      const items: AdminCartItem[] = (cart?.items ?? []).map((item) => {
        const price =
          item.product.price === null
            ? null
            : Number(item.product.price);

        return {
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            price,
            productType: item.product.productType,
            isAvailable: item.product.isAvailable,
            images: item.product.images,
          },
          lineTotal: price === null ? null : price * item.quantity,
        };
      });

      const hasMissingPrice = items.some(
        (item) => item.lineTotal === null,
      );

      return {
        id: cart?.id ?? `empty-${user.id}`,
        userId: user.id,
        customer: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        items,
        itemCount: items.length,
        totalQuantity: items.reduce(
          (total, item) => total + item.quantity,
          0,
        ),
        totalAmount: hasMissingPrice
          ? null
          : items.reduce(
              (total, item) => total + (item.lineTotal ?? 0),
              0,
            ),
        createdAt: cart?.createdAt ?? user.createdAt,
        updatedAt: cart?.updatedAt ?? user.updatedAt,
      };
    });

    return {
      success: true,
      message: 'Customer carts retrieved successfully',
      data,
      total: data.length,
    };
  }
}
