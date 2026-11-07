import {
  Controller,
  Delete,
  Get,
  Path,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import { AdminCartService } from '../services/admin-cart.service.js';
import type { AdminCartListResponse } from '../interfaces/admin-cart.interface.js';

const adminCartService = new AdminCartService();

@Route('admin/carts')
@Tags('Admin Carts')
@Security('jwt', ['ADMIN'])
export class AdminCartController extends Controller {
  @Get()
  @SuccessResponse('200', 'Success')
  public async getAllCarts(): Promise<AdminCartListResponse> {
    return adminCartService.getAllCarts();
  }

  @Delete('{userId}/items/{itemId}')
  @SuccessResponse('200', 'Item removed from customer cart')
  @Response(404, 'Customer or cart item not found')
  public async removeCustomerCartItem(
    @Path() userId: string,
    @Path() itemId: string,
  ): Promise<{ success: boolean; message: string }> {
    return adminCartService.removeCustomerCartItem(userId, itemId);
  }

  @Delete('{userId}/items')
  @SuccessResponse('200', 'Customer cart cleared')
  @Response(404, 'Customer not found')
  public async clearCustomerCart(
    @Path() userId: string,
  ): Promise<{ success: boolean; message: string }> {
    return adminCartService.clearCustomerCart(userId);
  }
}
