import { PrismaClient } from '@prisma/client';
import { WishlistResponse } from '../interfaces/wishlist.interface';
import { AppError } from '../utils/appError';

const prisma = new PrismaClient();

export class WishlistService {

  async getWishlist(userId: string): Promise<WishlistResponse> {
    const items = await prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return { success: true, message: 'Wishlist retrieved successfully', data: items };
  }

  async addItem(userId: string, productId: string): Promise<WishlistResponse> {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Product not found', 404);

    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });

    return this.getWishlist(userId);
  }

  async removeItem(userId: string, productId: string): Promise<WishlistResponse> {
    const item = await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
    if (!item) throw new AppError('Item not in wishlist', 404);

    await prisma.wishlistItem.delete({ where: { userId_productId: { userId, productId } } });
    return this.getWishlist(userId);
  }
}
