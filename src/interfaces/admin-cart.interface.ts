export interface AdminCartProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
  productId: string;
}

export interface AdminCartProduct {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  productType: string;
  isAvailable: boolean;
  images: AdminCartProductImage[];
}

export interface AdminCartItem {
  id: string;
  productId: string;
  quantity: number;
  size: string | null;
  color: string | null;
  product: AdminCartProduct;
  lineTotal: number | null;
}

export interface AdminCartCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface AdminCart {
  id: string;
  userId: string;
  customer: AdminCartCustomer;
  items: AdminCartItem[];
  itemCount: number;
  totalQuantity: number;
  totalAmount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminCartListResponse {
  success: boolean;
  message: string;
  data: AdminCart[];
  total: number;
}
