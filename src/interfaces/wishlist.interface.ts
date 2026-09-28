export interface WishlistItemData {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
}

export interface WishlistResponse {
  success: boolean;
  message: string;
  data: WishlistItemData[];
}
