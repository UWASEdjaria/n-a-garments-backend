export interface StockEntry {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  supplierNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddStockDTO {
  productId: string;
  quantity: number;
  unitCost: number;
  supplierNote?: string;
}

export interface EditStockDTO {
  quantity?: number;
  unitCost?: number;
  supplierNote?: string;
}