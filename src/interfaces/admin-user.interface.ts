export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CUSTOMER' | 'ADMIN';
  isEmailVerified: boolean;
  createdAt: Date;
  orderCount: number;
  customOrderCount: number;
  paidOrderSpend: number;
}

export interface AdminUserSummary {
  totalUsers: number;
  customerCount: number;
  adminCount: number;
  verifiedCount: number;
  unverifiedCount: number;
}

export interface AdminUserListResponse {
  success: boolean;
  message: string;
  data: AdminUser[];
  summary: AdminUserSummary;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
