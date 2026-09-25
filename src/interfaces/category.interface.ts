export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
}

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategorySingleResponse {
  success: boolean;
  message: string;
  data: CategoryData;
}

export interface CategoryListResponse {
  success: boolean;
  message: string;
  data: CategoryData[];
}