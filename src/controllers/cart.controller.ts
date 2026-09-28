import { Controller, Route, Get, Post, Put, Delete, Body, Path, Tags, Security, Request, SuccessResponse, Response } from 'tsoa';
import express from 'express';
import { CartService } from '../services/cart.service';
import { AddCartItemRequest, UpdateCartItemRequest, CartResponse } from '../interfaces/cart.interface';
import { getUser } from '../utils/getUser';

const cartService = new CartService();

@Route('cart')
@Tags('Cart')
@Security('jwt')
export class CartController extends Controller {

  /** Get current user's cart */
  @Get()
  @SuccessResponse('200', 'Success')
  public async getCart(@Request() request: express.Request): Promise<CartResponse> {
    return cartService.getCart(getUser(request).userId);
  }

  /** Add an item to cart */
  @Post('items')
  @SuccessResponse('200', 'Success')
  @Response(400, 'Bad Request')
  @Response(404, 'Product not found')
  public async addItem(@Request() request: express.Request, @Body() requestBody: AddCartItemRequest): Promise<CartResponse> {
    return cartService.addItem(getUser(request).userId, requestBody);
  }

  /** Update quantity of a cart item */
  @Put('items/{itemId}')
  @SuccessResponse('200', 'Success')
  @Response(404, 'Cart item not found')
  public async updateItem(
    @Request() request: express.Request,
    @Path() itemId: string,
    @Body() requestBody: UpdateCartItemRequest
  ): Promise<CartResponse> {
    return cartService.updateItem(getUser(request).userId, itemId, requestBody);
  }

  /** Remove an item from cart */
  @Delete('items/{itemId}')
  @SuccessResponse('200', 'Success')
  @Response(404, 'Cart item not found')
  public async removeItem(@Request() request: express.Request, @Path() itemId: string): Promise<CartResponse> {
    return cartService.removeItem(getUser(request).userId, itemId);
  }

  /** Clear all items from cart */
  @Delete()
  @SuccessResponse('200', 'Success')
  public async clearCart(@Request() request: express.Request): Promise<{ success: boolean; message: string }> {
    return cartService.clearCart(getUser(request).userId);
  }
}
