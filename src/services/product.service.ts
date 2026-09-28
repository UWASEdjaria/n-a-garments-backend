import { PrismaClient, Prisma } from "@prisma/client";
import { CreateProductDTO, Product, ProductFilters } from "../interfaces/product.interface";
import { AppError } from "../utils/appError";
import { ImageService } from "./image.service";

const prisma = new PrismaClient();

export class ProductsServices {
  private imageService = new ImageService();

  async createProduct(image: Express.Multer.File | undefined, data: CreateProductDTO): Promise<Product> {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new AppError("Category not found", 404);

    const existingSlug = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (existingSlug) throw new AppError("Product slug already exists", 400);

    let imageUrl = data.imageUrl;
    if (image) {
      const upload = await this.imageService.upload(image);
      imageUrl = upload.imageUrl;
    }

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
        imageUrl,
      },
    });

    return { ...product, price: Number(product.price) };
  }

  async getAllProducts(filters: ProductFilters): Promise<{ data: Product[]; totalPages: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
    if (filters.name) where.name = { contains: filters.name, mode: "insensitive" };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.slug) where.slug = filters.slug;

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => ({ ...p, price: Number(p.price) })),
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getProductById(id: string): Promise<Product | null> {
    const product = await prisma.product.findUnique({ where: { id } });
    return product ? { ...product, price: Number(product.price) } : null;
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError("Product not found", 404);
    await prisma.product.delete({ where: { id } });
  }
}