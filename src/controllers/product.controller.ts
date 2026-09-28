import { Controller, Delete, FormField, Get, Path, Post, Put, Query, Response, Route, Security, SuccessResponse, Tags, UploadedFile } from 'tsoa';
import { CreateProductDTO, UpdateProductDTO, Product } from '../interfaces/product.interface';
import { StandardErrorResponse } from '../interfaces/auth.interface';
import { ProductsServices } from '../services/product.service';
import { createProductSchema, ALLOWED_SIZES, ALLOWED_COLORS } from '../validators/product.validator';

const parseArray = (value?: string): string[] => {
  if (!value) return [];
  try { return JSON.parse(value) as string[]; } catch { return value.split(',').map((s) => s.trim()).filter(Boolean); }
};

@Route('products')
@Tags('Products')
export class ProductController extends Controller {
  private productService = new ProductsServices();

  /** List all products with optional filters and pagination */
  @Get('/')
  @SuccessResponse('200', 'Success')
  public async listProducts(
    @Query() name?: string,
    @Query() categoryId?: string,
    @Query() slug?: string,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<{ data: Product[]; totalPages: number }> {
    return this.productService.getAllProducts({ name, categoryId, slug, page, limit });
  }

  /** Returns all valid sizes and colors for products */
  @Get('/options')
  @SuccessResponse('200', 'Success')
  public async getProductOptions(): Promise<{ sizes: string[]; colors: string[] }> {
    return { sizes: [...ALLOWED_SIZES], colors: [...ALLOWED_COLORS] };
  }

  /** Get a single product by ID */
  @Get('/{id}')
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Product not found')
  public async getProduct(@Path() id: string): Promise<Product> {
    return this.productService.getProductById(id);
  }

  /** Get a single product by slug */
  @Get('/slug/{slug}')
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Product not found')
  public async getProductBySlug(@Path() slug: string): Promise<Product> {
    return this.productService.getProductBySlug(slug);
  }

  /** Create a new product — Admin only */
  @Post('/')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('201', 'Created')
  @Response<StandardErrorResponse>(400, 'Bad Request')
  @Response<StandardErrorResponse>(404, 'Category not found')
  public async createProduct(
    @FormField() name: string,
    @FormField() slug: string,
    @FormField() description: string,
    @FormField() price: number,
    @FormField() categoryId: string,
    @FormField() stockQuantity?: number,
    @FormField() minimumStockLevel?: number,
    @FormField() sizes?: string,
    @FormField() colors?: string,
    @FormField() imageUrl?: string,
    @UploadedFile() image?: Express.Multer.File
  ): Promise<Product> {
    const dto: CreateProductDTO = {
      name,
      slug,
      description,
      price: Number(price),
      categoryId,
      stockQuantity: stockQuantity ? Number(stockQuantity) : 0,
      minimumStockLevel: minimumStockLevel ? Number(minimumStockLevel) : 5,
      sizes: parseArray(sizes),
      colors: parseArray(colors),
      imageUrl: imageUrl === 'undefined' ? undefined : imageUrl,
    };
    createProductSchema.parse(dto);
    const result = await this.productService.createProduct(image, dto);
    this.setStatus(201);
    return result;
  }

  /** Update a product — Admin only */
  @Put('/{id}')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Product not found')
  public async updateProduct(
    @Path() id: string,
    @FormField() name?: string,
    @FormField() slug?: string,
    @FormField() description?: string,
    @FormField() price?: number,
    @FormField() categoryId?: string,
    @FormField() stockQuantity?: number,
    @FormField() minimumStockLevel?: number,
    @FormField() sizes?: string,
    @FormField() colors?: string,
    @FormField() imageUrl?: string,
    @UploadedFile() image?: Express.Multer.File
  ): Promise<Product> {
    const dto: UpdateProductDTO = {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(description && { description }),
      ...(price !== undefined && { price: Number(price) }),
      ...(categoryId && { categoryId }),
      ...(stockQuantity !== undefined && { stockQuantity: Number(stockQuantity) }),
      ...(minimumStockLevel !== undefined && { minimumStockLevel: Number(minimumStockLevel) }),
      ...(sizes && { sizes: parseArray(sizes) }),
      ...(colors && { colors: parseArray(colors) }),
      ...(imageUrl && imageUrl !== 'undefined' && { imageUrl }),
    };
    return this.productService.updateProduct(id, image, dto);
  }

  /** Toggle product availability — Admin only */
  @Put('/{id}/availability')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Product not found')
  public async toggleAvailability(@Path() id: string): Promise<Product> {
    return this.productService.toggleAvailability(id);
  }

  /** Delete a product — Admin only */
  @Delete('/{id}')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Product not found')
  public async deleteProduct(@Path() id: string): Promise<{ success: boolean; message: string }> {
    await this.productService.deleteProduct(id);
    return { success: true, message: 'Product deleted successfully' };
  }
}
