import { Controller, Route,Query, Post, Get, Body, SuccessResponse, Response, Tags, Security, Request } from 'tsoa';
import express from 'express';
import { AuthService } from '../services/auth.service.js';
import { RegisterRequest, LoginRequest, AuthResponse, AuthUserData, StandardErrorResponse, ForgotPasswordRequest, ResetPasswordRequest, MessageResponse } from '../interfaces/auth.interface.js';
import { getUser } from '../utils/getUser.js';

const authService = new AuthService();

@Route('auth')
@Tags('Authentication')
export class AuthController extends Controller {

  /** Registers a new customer */
  @Post('register')
  @SuccessResponse('201','Registration successful. Verification email sent')
  @Response<StandardErrorResponse>(400, 'Bad Request')
  @Response<StandardErrorResponse>(409, 'Conflict - Email already exists')
  public async register(@Body() requestBody: RegisterRequest): Promise<MessageResponse> {
    const result = await authService.register(requestBody);
    this.setStatus(201);
    return result;
  }

  /** Authenticates any user — role is returned in the response */
  @Post('login')
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(400, 'Bad Request')
  @Response<StandardErrorResponse>(401, 'Unauthorized')
  public async login(@Body() requestBody: LoginRequest): Promise<AuthResponse> {
    return authService.login(requestBody);
  }

  /** Returns the current authenticated user profile */
  @Get('me')
  @Security('jwt')
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(401, 'Unauthorized')
  public async getMe(@Request() request: express.Request): Promise<{ success: boolean; data: AuthUserData }> {
    return authService.getMe(getUser(request));
  }

  /** Sends a password reset link to the user's email */
  @Post('forgot-password')
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(400, 'Bad Request')
  public async forgotPassword(@Body() requestBody: ForgotPasswordRequest): Promise<MessageResponse> {
    return authService.forgotPassword(requestBody);
  }

  /** Resets the user's password using the token from the email link */
  @Post('reset-password')
  @SuccessResponse('200', 'Success')
  @Response<StandardErrorResponse>(400, 'Invalid or expired token')
  public async resetPassword(@Body() requestBody: ResetPasswordRequest): Promise<MessageResponse> {
    return authService.resetPassword(requestBody);
  }
  
    /** Verifies a customer's email address */
  @Get('verify-email')
  @SuccessResponse('200', 'Email verified successfully')
  @Response<StandardErrorResponse>(400, 'Invalid or expired verification link')
  public async verifyEmail(@Query() token: string): Promise<MessageResponse> {
    return authService.verifyEmail(token);
  }
}
