export type StockStatus = 'out_of_stock' | 'low' | 'normal' | 'overstock';
export type ProductType = 'READY_TO_WEAR' | 'MADE_TO_ORDER';

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
  price: number | null;
  stockQuantity: number;
  minimumStockLevel: number;
  maximumStockLevel: number;
  isAvailable: boolean;
  productType: ProductType;
  stockStatus: StockStatus;
  sizes: string[];
  colors: string[];
  images: ProductImage[];
  imageUrl?: string;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductDTO {
  name: string;
  slug: string;
  description: string;
  price: number | null;
  stockQuantity?: number;
  minimumStockLevel?: number;
  maximumStockLevel?: number;
  sizes?: string[];
  colors?: string[];
  categoryId: string;
  imageUrl?: string;
  isAvailable?: boolean;
  productType?: ProductType;
}

export interface UpdateProductDTO {
  name?: string;
  slug?: string;
  description?: string;
  price?: number | null;
  stockQuantity?: number;
  minimumStockLevel?: number;
  maximumStockLevel?: number;
  isAvailable?: boolean;
  productType?: ProductType;
  sizes?: string[];
  colors?: string[];
  categoryId?: string;
  imageUrl?: string;
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  slug?: string;
  page?: number;
  limit?: number;
}
