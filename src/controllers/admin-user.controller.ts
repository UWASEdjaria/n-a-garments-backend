import {
  Controller,
  Get,
  Query,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import { AdminUserService } from '../services/admin-user.service.js';
import type { AdminUserListResponse } from '../interfaces/admin-user.interface.js';

const adminUserService = new AdminUserService();

@Route('admin/users')
@Tags('Admin Users')
@Security('jwt', ['ADMIN'])
export class AdminUserController extends Controller {
  @Get()
  @SuccessResponse('200', 'Success')
  public async getUsers(
    @Query() search?: string,
    @Query() role?: string,
    @Query() verified?: string,
    @Query() page?: number,
    @Query() pageSize?: number,
  ): Promise<AdminUserListResponse> {
    return adminUserService.getUsers(
      search,
      role,
      verified,
      page,
      pageSize,
    );
  }
}
