export type StockStatus = 'low' | 'medium' | 'overstock';

export interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
  productId: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stockQuantity: number;
  minimumStockLevel: number;
  isAvailable: boolean;
  stockStatus: StockStatus;
  sizes: string[];
  colors: string[];
  images: ProductImage[];
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
