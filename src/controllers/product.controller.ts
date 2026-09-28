import { Body, Controller, Delete, FormField, Get, Path, Post, Query, Route, Security, Tags, UploadedFile } from "tsoa";
import { CreateProductDTO, Product } from "../interfaces/product.interface";
import { ProductsServices } from "../services/product.service";
import { createProductSchema } from "../validators/product.validator";

@Route("products")
@Tags("Products")
export class ProductController extends Controller {
  private productService = new ProductsServices();

  @Get("/")
  public async listProducts(
    @Query() name?: string,
    @Query() categoryId?: string,
    @Query() slug?: string,
    @Query() page?: number,
    @Query() limit?: number
  ): Promise<{ data: Product[]; totalPages: number }> {
    return await this.productService.getAllProducts({ name, categoryId, slug, page, limit });
  }

  @Get("/{id}")
  public async getProduct(@Path() id: string): Promise<Product | null> {
    return await this.productService.getProductById(id);
  }

  @Post("/")
  @Security("jwt", ["ADMIN"])
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
      sizes: sizes ? (JSON.parse(sizes) as string[]) : [],
      colors: colors ? (JSON.parse(colors) as string[]) : [],
      imageUrl: imageUrl === "undefined" ? undefined : imageUrl,
    };
    createProductSchema.parse(dto);

    return await this.productService.createProduct(image, dto);
  }

  @Delete("/{id}")
  @Security("jwt", ["ADMIN"])
  public async deleteProduct(@Path() id: string): Promise<{ success: boolean; message: string }> {
    await this.productService.deleteProduct(id);
    return { success: true, message: "Product deleted successfully" };
  }
}