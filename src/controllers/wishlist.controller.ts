import { Controller, Route, Get, Post, Delete, Path, Tags, Security, Request, SuccessResponse, Response } from 'tsoa';
import express from 'express';
import { WishlistService } from '../services/wishlist.service';
import { WishlistResponse } from '../interfaces/wishlist.interface';
import { getUser } from '../utils/getUser';

const wishlistService = new WishlistService();

@Route('wishlist')
@Tags('Wishlist')
@Security('jwt', ['CUSTOMER'])
export class WishlistController extends Controller {

  /** Get current user's wishlist */
  @Get()
  @SuccessResponse('200', 'Success')
  public async getWishlist(@Request() request: express.Request): Promise<WishlistResponse> {
    return wishlistService.getWishlist(getUser(request).userId);
  }

  /** Add a product to wishlist */
  @Post('{productId}')
  @SuccessResponse('200', 'Success')
  @Response(404, 'Product not found')
  public async addItem(@Request() request: express.Request, @Path() productId: string): Promise<WishlistResponse> {
    return wishlistService.addItem(getUser(request).userId, productId);
  }

  /** Remove a product from wishlist */
  @Delete('{productId}')
  @SuccessResponse('200', 'Success')
  @Response(404, 'Item not in wishlist')
  public async removeItem(@Request() request: express.Request, @Path() productId: string): Promise<WishlistResponse> {
    return wishlistService.removeItem(getUser(request).userId, productId);
  }
}
