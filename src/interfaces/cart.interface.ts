export interface CartItemData {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  size: string | null;
  color: string | null;
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
