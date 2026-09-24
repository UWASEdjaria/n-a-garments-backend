import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateToken, JwtPayload } from '../config/jwt';
import { RegisterRequest, LoginRequest, AuthResponse, AuthUserData } from '../interfaces/auth.interface';
import { AppError } from '../utils/appError';

const prisma = new PrismaClient();

export class AuthService {

  private buildAuthResponse(user: User, message: string): AuthResponse {
    const token = generateToken({ userId: user.id, role: user.role, email: user.email });
    return {
      success: true,
      message,
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } },
    };
  }

  private async findAndVerifyUser(email: string, password: string): Promise<User> {
    if (!email || !password) throw new AppError('Email and password are required.', 400);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new AppError('Invalid email or password.', 401);
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password.', 401);
    return user;
  }

  async register(body: RegisterRequest): Promise<AuthResponse> {
    const { name, email, password, confirmPassword, phone } = body;

    if (!name || !email || !password || !confirmPassword)
      throw new AppError('Name, email, password, and confirm password are required.', 400);

    if (password !== confirmPassword)
      throw new AppError('Passwords do not match.', 400);

    if (password.length < 6)
      throw new AppError('Password must be at least 6 characters long.', 400);

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) throw new AppError('User with this email already exists.', 409);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone ? phone.trim() : null,
        role: 'CUSTOMER',
      },
    });

    return this.buildAuthResponse(user, 'Registration successful');
  }

  async login(body: LoginRequest): Promise<AuthResponse> {
    const user = await this.findAndVerifyUser(body.email, body.password);
    return this.buildAuthResponse(user, 'Login successful');
  }

  async getMe(authUser: JwtPayload): Promise<{ success: boolean; data: AuthUserData }> {
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, name: true, email: true, role: true, phone: true },
    });

    if (!user) throw new AppError('User not found.', 404);

    return { success: true, data: user };
  }
}
