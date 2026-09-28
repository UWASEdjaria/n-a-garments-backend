export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stockQuantity: number;
  minimumStockLevel: number;
  sizes: string[];
  colors: string[];
  imageUrl?: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProductDTO {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  stockQuantity?: number;
  minimumStockLevel?: number;
  sizes?: string[];
  colors?: string[];
  categoryId?: string;
  imageUrl?: string;
}

export interface CreateProductDTO {
  name: string;
  slug: string;
  description: string;
  price: number;
  stockQuantity?: number;
  minimumStockLevel?: number;
  sizes?: string[];
  colors?: string[];
  categoryId: string;
  imageUrl?: string;
}

export interface ProductFilters {
  name?: string;
  categoryId?: string;
  slug?: string;
  page?: number;
  limit?: number;
}