export interface CartItemData {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  size: string | null;
  color: string | null;
  product?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    stockQuantity: number;
    minimumStockLevel: number;
    maximumStockLevel: number;
    isAvailable: boolean;
    productType: string;
    sizes: string[];
    colors: string[];
    images: { id: string; url: string; isPrimary: boolean; productId: string }[];
    imageUrl?: string;
    categoryId: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface CartData {
  id: string;
  userId: string;
  items: CartItemData[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AddCartItemRequest {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface CartResponse {
  success: boolean;
  message: string;
  data: CartData;
}
