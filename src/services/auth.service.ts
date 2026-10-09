import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken } from '../config/jwt.js';
import { RegisterRequest, LoginRequest, AuthResponse, AuthUserData, JwtPayload, ForgotPasswordRequest, ResetPasswordRequest, MessageResponse } from '../interfaces/auth.interface.js';
import { AppError } from '../utils/appError.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/email.js';

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

  async register(body: RegisterRequest): Promise<MessageResponse> {
  const { name, email, password, confirmPassword, phone } = body;

  if (!name || !email || !password || !confirmPassword) {
    throw new AppError(
      'Name, email, password, and confirm password are required.',
      400
    );
  }

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match.', 400);
  }

  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new AppError('User with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiry = new Date(Date.now() + 30 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phone: phone ? phone.trim() : null,
      role: 'CUSTOMER',
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiry: verificationExpiry,
    },
  });

  const verificationUrl =
    `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  try {
    await sendVerificationEmail(user.email, user.name, verificationUrl);
  } catch {
    await prisma.user.delete({ where: { id: user.id } });

    throw new AppError(
      'Unable to send verification email. Please try registering again.',
      500
    );
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Customer registration successful for ${user.email}. Email verification token: ${verificationToken}`);
  }

  return {
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
  };
}

  async login(body: LoginRequest): Promise<AuthResponse> {
const user = await this.findAndVerifyUser(body.email, body.password);
if (!user.isEmailVerified) {
  throw new AppError(
    'Please verify your email before logging in.',
    403
  );
}
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

  async forgotPassword(body: ForgotPasswordRequest): Promise<MessageResponse> {
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });

    // Always return success to prevent email enumeration
    if (!user) return { success: true, message: 'If this email exists, a reset link has been sent.' };

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (err) {
      console.log('[forgotPassword] Email sending failed:', err);
      // In development, log the reset URL to terminal so you can test without email
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n🔑 [DEV] Password reset URL for ${user.email}:\n${resetUrl}\n`);
      } else {
        throw new AppError('Failed to send reset email. Please try again.', 500);
      }
    }

    return { success: true, message: 'If this email exists, a reset link has been sent.' };
  }

  async resetPassword(body: ResetPasswordRequest): Promise<MessageResponse> {
    if (!body.token) throw new AppError('Reset token is required.', 400);

    if (body.password !== body.confirmPassword)
      throw new AppError('Passwords do not match.', 400);

    if (body.password.length < 6)
      throw new AppError('Password must be at least 6 characters long.', 400);

    const user = await prisma.user.findFirst({
      where: {
        resetToken: body.token,
        resetTokenExpiry: { gt: new Date() }, // token not expired
      },
    });

    if (!user) throw new AppError('Invalid or expired reset token.', 400);

    const passwordHash = await bcrypt.hash(body.password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    return { success: true, message: 'Password reset successfully. You can now log in.' };
  }

  async verifyEmail(token: string): Promise<MessageResponse> {
  if (!token) {
    throw new AppError('Verification token is required.', 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationTokenExpiry: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new AppError('Invalid or expired verification link.', 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiry: null,
    },
  });

  return {
    success: true,
    message: 'Email verified successfully. You can now log in.',
  };
}
}
