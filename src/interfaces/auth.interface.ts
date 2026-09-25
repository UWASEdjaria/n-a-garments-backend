export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
}

export interface AuthResponsePayload {
  token: string;
  user: AuthUserData;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: AuthResponsePayload;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface StandardErrorResponse {
  success: false;
  message: string;
  data: null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface MessageResponse {
  success: boolean;
  message: string;
}
