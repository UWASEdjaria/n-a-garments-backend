export interface CreateCategoryRequest {
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  imageUrl?: string;
}

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl?: string | null;
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