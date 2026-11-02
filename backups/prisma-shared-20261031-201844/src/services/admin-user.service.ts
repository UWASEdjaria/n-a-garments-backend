import { Prisma, PrismaClient } from '@prisma/client';
import type {
  AdminUser,
  AdminUserListResponse,
  AdminUserSummary,
} from '../interfaces/admin-user.interface.js';

const prisma = new PrismaClient();

export class AdminUserService {
  async getUsers(
    search = '',
    role = 'ALL',
    verified = 'ALL',
    requestedPage = 1,
    requestedPageSize = 10,
  ): Promise<AdminUserListResponse> {
    const page = Number.isFinite(requestedPage)
      ? Math.max(1, Math.floor(requestedPage))
      : 1;

    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.min(100, Math.max(1, Math.floor(requestedPageSize)))
      : 10;

    const where: Prisma.UserWhereInput = {};
    const cleanSearch = search.trim();

    if (role === 'CUSTOMER' || role === 'ADMIN') {
      where.role = role;
    }

    if (verified === 'true') {
      where.isEmailVerified = true;
    } else if (verified === 'false') {
      where.isEmailVerified = false;
    }

    if (cleanSearch) {
      where.OR = [
        { name: { contains: cleanSearch, mode: 'insensitive' } },
        { email: { contains: cleanSearch, mode: 'insensitive' } },
        { phone: { contains: cleanSearch, mode: 'insensitive' } },
      ];
    }

    const [
      total,
      totalUsers,
      customerCount,
      adminCount,
      verifiedCount,
      unverifiedCount,
      users,
    ] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { isEmailVerified: true } }),
      prisma.user.count({ where: { isEmailVerified: false } }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
          orders: {
            where: { paymentStatus: 'PAID' },
            select: { totalAmount: true },
          },
          _count: {
            select: {
              orders: true,
              customOrders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const data: AdminUser[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      orderCount: user._count.orders,
      customOrderCount: user._count.customOrders,
      paidOrderSpend: user.orders.reduce(
        (sum, order) => sum + Number(order.totalAmount),
        0,
      ),
    }));

    const summary: AdminUserSummary = {
      totalUsers,
      customerCount,
      adminCount,
      verifiedCount,
      unverifiedCount,
    };

    return {
      success: true,
      message: 'Users retrieved successfully',
      data,
      summary,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
