import { Controller, Delete, FormField, Get, Path, Post, Put, Query, Response, Route, Security, SuccessResponse, Tags, UploadedFile } from 'tsoa';
import { CreateProductDTO, UpdateProductDTO, Product } from '../interfaces/product.interface.js';
import { StandardErrorResponse } from '../interfaces/auth.interface.js';
import { ProductsServices } from '../services/product.service.js';
import { createProductSchema, updateProductSchema, ALLOWED_SIZES, ALLOWED_COLORS, ALLOWED_PRODUCT_TYPES } from '../validators/product.validator.js';
import { AppError } from '../utils/appError.js';

const parseArray = (value?: string): string[] => {
  if (!value) return [];
  try { return JSON.parse(value) as string[]; } catch { return value.split(',').map((s) => s.trim()).filter(Boolean); }
};
const cleanOptionalString = (value?: string): string | undefined => {
  if (!value || value === 'string' || value === 'undefined') {
    return undefined;
  }
  return value;
};
const parseOptionalNumber = (value?: string): number | undefined => {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new AppError('Numeric fields must be valid numbers', 400);
  return parsed;
};
const parseOptionalBoolean = (value?: string): boolean | undefined => {
  if (value === undefined || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new AppError('Availability must be true or false', 400);
};
const parseProductType = (value?: string): 'READY_TO_WEAR' | 'MADE_TO_ORDER' | undefined => {
  if (!value || !ALLOWED_PRODUCT_TYPES.includes(value as 'READY_TO_WEAR' | 'MADE_TO_ORDER')) return undefined;
  return value as 'READY_TO_WEAR' | 'MADE_TO_ORDER';
};

@Route('products')
@Tags('Products')
export class ProductController extends Controller {
  private productService = new ProductsServices();

  /** List all products with optional filters and pagination */
  @Get('/')
  @SuccessResponse('200', 'Success')
  public async listProducts(
    @Query() search?: string,
    @Query() categoryId?: string,
    @Query() slug?: string,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<{ data: Product[]; totalPages: number }> {
    return this.productService.getAllProducts({ search, categoryId, slug, page, limit });
  }

  /** Returns all valid sizes, colors, and product types */
  @Get('/options')
  @SuccessResponse('200', 'Success')
  public async getProductOptions(): Promise<{ sizes: string[]; colors: string[]; productTypes: string[] }> {
    return { sizes: [...ALLOWED_SIZES], colors: [...ALLOWED_COLORS], productTypes: [...ALLOWED_PRODUCT_TYPES] };
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
    @FormField() categoryId: string,
    @FormField() price?: string,
    @FormField() stockQuantity?: number,
    @FormField() minimumStockLevel?: number,
    @FormField() maximumStockLevel?: number,
    @FormField() isAvailable?: string,
    @FormField() productType?: string,
    @FormField() sizes?: string,
    @FormField() colors?: string,
    @FormField() imageUrl?: string,
    @UploadedFile() image?: Express.Multer.File
  ): Promise<Product> {
    const dto: CreateProductDTO = {
      name,
      slug,
      description,
      price: parseOptionalNumber(price) ?? null,
      categoryId,
      stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : 0,
      minimumStockLevel: minimumStockLevel !== undefined ? Number(minimumStockLevel) : 5,
      maximumStockLevel: maximumStockLevel !== undefined ? Number(maximumStockLevel) : 100,
      isAvailable: parseOptionalBoolean(isAvailable) ?? true,
      productType: parseProductType(productType) ?? 'READY_TO_WEAR',
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
    @FormField() price?: string,
    @FormField() categoryId?: string,
    @FormField() stockQuantity?: string,
    @FormField() minimumStockLevel?: string,
    @FormField() maximumStockLevel?: string,
    @FormField() isAvailable?: string,
    @FormField() productType?: string,
    @FormField() sizes?: string,
    @FormField() colors?: string,
    @FormField() imageUrl?: string,
    @UploadedFile() image?: Express.Multer.File
  ): Promise<Product> {
    const parsedPrice = price === undefined
  ? undefined
  : price.trim() === ''
    ? null
    : parseOptionalNumber(price);
    const parsedStockQuantity = parseOptionalNumber(stockQuantity);
    const parsedMinimumStockLevel = parseOptionalNumber(minimumStockLevel);
    const parsedMaximumStockLevel = parseOptionalNumber(maximumStockLevel);
    const parsedIsAvailable = parseOptionalBoolean(isAvailable);
    const parsedProductType = parseProductType(productType);
    const dto: UpdateProductDTO = {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(description && { description }),
      ...(parsedPrice !== undefined && { price: parsedPrice }),
      ...(cleanOptionalString(categoryId) && { categoryId: cleanOptionalString(categoryId) }),
      ...(parsedStockQuantity !== undefined && { stockQuantity: parsedStockQuantity }),
      ...(parsedMinimumStockLevel !== undefined && { minimumStockLevel: parsedMinimumStockLevel }),
      ...(parsedMaximumStockLevel !== undefined && { maximumStockLevel: parsedMaximumStockLevel }),
      ...(parsedIsAvailable !== undefined && { isAvailable: parsedIsAvailable }),
      ...(parsedProductType && { productType: parsedProductType }),
     ...(sizes !== undefined && { sizes: parseArray(sizes) }),
     ...(colors !== undefined && { colors: parseArray(colors) }),
      ...(cleanOptionalString(imageUrl) && { imageUrl: cleanOptionalString(imageUrl) }),
    };
    updateProductSchema.parse(dto);
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
