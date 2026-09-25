import { Controller, Route, Post, Get, Put, Delete, Body, Path, Query, SuccessResponse, Response, Tags, Security } from 'tsoa';
import { CategoryService } from '../services/category.service';
import { CreateCategoryRequest, UpdateCategoryRequest, CategorySingleResponse, CategoryListResponse } from '../interfaces/category.interface';
import { StandardErrorResponse } from '../interfaces/auth.interface';

const categoryService = new CategoryService();

@Route('categories')
@Tags('Categories')
export class CategoryController extends Controller {

  /** Get all categories with optional search */
  @Get()
  @SuccessResponse('200', 'Success')
  public async getAllCategories(@Query() search?: string): Promise<CategoryListResponse> {
    return categoryService.getAllCategories(search);
  }

  /** Get a single category by ID */
  @Get('{id}')
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Category not found')
  public async getCategoryById(@Path() id: string): Promise<CategorySingleResponse> {
    return categoryService.getCategoryById(id);
  }

  /** Create a new category — Admin only */
  @Post()
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('201', 'Created')
  @Response<StandardErrorResponse>(400, 'Bad Request')
  @Response<StandardErrorResponse>(409, 'Conflict - Category already exists')
  public async createCategory(@Body() requestBody: CreateCategoryRequest): Promise<CategorySingleResponse> {
    const result = await categoryService.createCategory(requestBody);
    this.setStatus(201);
    return result;
  }

  /** Update a category — Admin only */
  @Put('{id}')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(400, 'Bad Request')
  @Response<StandardErrorResponse>(404, 'Category not found')
  @Response<StandardErrorResponse>(409, 'Conflict')
  public async updateCategory(@Path() id: string, @Body() requestBody: UpdateCategoryRequest): Promise<CategorySingleResponse> {
    return categoryService.updateCategory(id, requestBody);
  }

  /** Delete a category — Admin only */
  @Delete('{id}')
  @Security('jwt', ['ADMIN'])
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(404, 'Category not found')
  public async deleteCategory(@Path() id: string): Promise<{ success: boolean; message: string }> {
    return categoryService.deleteCategory(id);
  }
}
