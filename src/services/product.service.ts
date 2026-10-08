import { PrismaClient, Prisma, Product as PrismaProduct, ProductImage as PrismaProductImage } from '@prisma/client';
import { CreateProductDTO, UpdateProductDTO, Product, ProductFilters, StockStatus } from '../interfaces/product.interface.js';
import { AppError } from '../utils/appError.js';
import { ImageService } from './image.service.js';

const prisma = new PrismaClient();

type PrismaProductWithImages = PrismaProduct & { images: PrismaProductImage[] };

export class ProductsServices {
  private imageService = new ImageService();

  private getStockStatus(qty: number, minimumStockLevel: number): StockStatus {
    if (qty > 100) return 'overstock';
    if (qty <= minimumStockLevel) return 'low';
    return 'medium';
  }

  private format(p: PrismaProductWithImages): Product {
    const primaryImageUrl = p.images?.find((img) => img.isPrimary)?.url || p.images?.[0]?.url;
    return { ...p, price: Number(p.price), stockStatus: this.getStockStatus(p.stockQuantity, p.minimumStockLevel),imageUrl: primaryImageUrl, };
  }

  private async resolveImageUrl(image?: Express.Multer.File, imageUrl?: string): Promise<string | undefined> {
    if (image) return (await this.imageService.upload(image)).imageUrl;
    if (imageUrl && imageUrl !== 'undefined') return imageUrl;
    return undefined;
  }

  async createProduct(image: Express.Multer.File | undefined, data: CreateProductDTO): Promise<Product> {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new AppError('Category not found', 404);

    const existingSlug = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (existingSlug) throw new AppError('Product slug already exists', 400);

    const resolvedUrl = await this.resolveImageUrl(image, data.imageUrl);

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        price: data.price,
        stockQuantity: data.stockQuantity ?? 0,
        minimumStockLevel: data.minimumStockLevel ?? 5,
        sizes: data.sizes ?? [],
        colors: data.colors ?? [],
        categoryId: data.categoryId,
        ...(resolvedUrl && {
          images: { create: { url: resolvedUrl, isPrimary: true } },
        }),
      },
      include: { images: true,  category: true, },
    });

    return this.format(product);
  }

  async getAllProducts(filters: ProductFilters): Promise<{ data: Product[]; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
   if (filters.search) { where.OR = [ {   name: { contains: filters.search, mode: 'insensitive',}, }, {   description: { contains: filters.search, mode: 'insensitive',}, }, {
      slug: {contains: filters.search,mode: 'insensitive',},},{category: {  name: {contains: filters.search, mode: 'insensitive',},}, },];}
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.slug) where.slug = filters.slug;

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { images: true } }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.format(p)),
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getProductById(id: string): Promise<Product> {
    const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!product) throw new AppError('Product not found', 404);
    return this.format(product);
  }

  async getProductBySlug(slug: string): Promise<Product> {
    const product = await prisma.product.findUnique({ where: { slug }, include: { images: true } });
    if (!product) throw new AppError('Product not found', 404);
    return this.format(product);
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!product) throw new AppError('Product not found', 404);

    // Delete images from Cloudinary before removing DB record
    for (const img of product.images) {
      // Cloudinary public_id is embedded in the URL path after /upload/
      const match = img.url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
      if (match) {
        await this.imageService.delete(match[1]).catch(() => null);
      }
    }

    await prisma.product.delete({ where: { id } });
  }

  async updateProduct(id: string, image: Express.Multer.File | undefined, data: UpdateProductDTO): Promise<Product> {
    const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!product) throw new AppError('Product not found', 404);

    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) throw new AppError('Category not found', 404);
    }

    if (data.slug && data.slug !== product.slug) {
      const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
      if (existing) throw new AppError('Product slug already exists', 400);
    }

    const resolvedUrl = await this.resolveImageUrl(image, data.imageUrl);

    // If a new image is provided, delete all existing images first
    if (resolvedUrl && product.images.length > 0) {
      for (const img of product.images) {
        const match = img.url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
        if (match) {
          await this.imageService.delete(match[1]).catch(() => null);
        }
      }
      await prisma.productImage.deleteMany({ where: { productId: id } });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.description && { description: data.description }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.stockQuantity !== undefined && { stockQuantity: data.stockQuantity }),
        ...(data.minimumStockLevel !== undefined && { minimumStockLevel: data.minimumStockLevel }),
        ...(data.sizes && { sizes: data.sizes }),
        ...(data.colors && { colors: data.colors }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(resolvedUrl && {
          images: { create: { url: resolvedUrl, isPrimary: true } },
        }),
      },
      include: { images: true },
    });

    return this.format(updated);
  }

  async toggleAvailability(id: string): Promise<Product> {
    const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!product) throw new AppError('Product not found', 404);

    const updated = await prisma.product.update({
      where: { id },
      data: { isAvailable: !product.isAvailable },
      include: { images: true },
    });

    return this.format(updated);
  }
}
