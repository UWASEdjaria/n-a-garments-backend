import type { StockStatus } from './product.interface.js';

export interface StockProductSummary {
  id: string;
  name: string;
  stockQuantity: number;
  minimumStockLevel: number;
  maximumStockLevel: number;
  stockStatus: StockStatus;
  images: { id: string; url: string; isPrimary: boolean; productId: string }[];
}

export interface StockEntry {
  id: string;
  batchCode: string;
  productId: string;
  quantity: number;
  unitCost: number;
  supplierNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
  product: StockProductSummary;
}

export interface StockSummary {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  overstock: number;
}

export interface AddStockDTO {
  productId: string;
  batchCode?: string;
  quantity: number;
  unitCost: number;
  supplierNote?: string;
}

export interface EditStockDTO {
  batchCode?: string;
  quantity?: number;
  unitCost?: number;
  supplierNote?: string;
}

export interface DeleteStockResponse {
  success: boolean;
  message: string;
}