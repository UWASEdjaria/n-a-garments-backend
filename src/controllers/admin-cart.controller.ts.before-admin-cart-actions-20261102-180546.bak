import { Controller, Get, Route, Security, SuccessResponse, Tags } from 'tsoa';
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
}