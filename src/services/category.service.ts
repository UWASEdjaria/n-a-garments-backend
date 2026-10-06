import { Prisma, PrismaClient } from '@prisma/client';
import { 
  CreateCategoryRequest, 
  UpdateCategoryRequest, 
  CategorySingleResponse, 
  CategoryListResponse 
} from '../interfaces/category.interface.js';
import { AppError } from '../utils/appError.js';

const prisma = new PrismaClient();

export class CategoryService {
  // Generate URL-friendly slug
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-');
  }

  // Create new category
  async createCategory(body: CreateCategoryRequest): Promise<CategorySingleResponse> {
    if (!body.name || body.name.trim().length < 2) {
      throw new AppError('Category name must be at least 2 characters long.', 400);
    }

    const slug = this.generateSlug(body.name);

    const existing = await prisma.category.findFirst({
      where: { OR: [{ name: body.name.trim() }, { slug }] },
    });

    if (existing) {
      throw new AppError('Category with this name or slug already exists.', 409);
    }

    const category = await prisma.category.create({
      data: {
        name: body.name.trim(),
        slug,
        description: body.description ? body.description.trim() : null,
        imageUrl: body.imageUrl ? body.imageUrl.trim() : null,
      },
    });

    return {
      success: true,
      message: 'Category created successfully',
      data: category,
    };
  }

  // Get all categories with optional search filter
  async getAllCategories(search?: string): Promise<CategoryListResponse> {
    const whereClause: Prisma.CategoryWhereInput = search && search.trim() !== ''
      ? {
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' } },
            { slug: { contains: search.trim(), mode: 'insensitive' } },
            { description: { contains: search.trim(), mode: 'insensitive' } },
          ],
        }
      : {};

    const categories = await prisma.category.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
    };
  }

  // Get category by ID
  async getCategoryById(id: string): Promise<CategorySingleResponse> {
    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new AppError('Category not found.', 404);
    }

    return {
      success: true,
      message: 'Category retrieved successfully',
      data: category,
    };
  }

  // Edit category by ID
  async updateCategory(id: string, body: UpdateCategoryRequest): Promise<CategorySingleResponse> {
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('Category not found.', 404);
    }

    const updateData: { name?: string; slug?: string; description?: string | null; imageUrl?: string | null } = {};

    if (body.name !== undefined) {
      const trimmedName = body.name.trim();

      if (trimmedName.length < 2) {
        throw new AppError('Category name must be at least 2 characters long.', 400);
      }

      const newSlug = this.generateSlug(trimmedName);

      const duplicate = await prisma.category.findFirst({
        where: {
          OR: [{ name: trimmedName }, { slug: newSlug }],
          NOT: { id },
        },
      });

      if (duplicate) {
        throw new AppError('Category name or slug conflicts with an existing category.', 409);
      }

      updateData.name = trimmedName;
      updateData.slug = newSlug;
    }

    if (body.description !== undefined) {
      updateData.description = body.description ? body.description.trim() : null;
    }
    if (body.imageUrl !== undefined) {
      updateData.imageUrl = body.imageUrl ? body.imageUrl.trim() : null;
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
    });
    
    return {
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory,
    };
  }

  // Delete category by ID
  async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('Category not found.', 404);
    }

    await prisma.category.delete({ where: { id } });

    return {
      success: true,
      message: 'Category deleted successfully',
    };
  }
}