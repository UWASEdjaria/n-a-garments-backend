import { Controller, Route, Post, Get, Body, SuccessResponse, Response, Tags, Security, Request } from 'tsoa';
import express from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterRequest, LoginRequest, AuthResponse, AuthUserData, StandardErrorResponse, ForgotPasswordRequest, ResetPasswordRequest, MessageResponse } from '../interfaces/auth.interface';
import { getUser } from '../utils/getUser';

const authService = new AuthService();

@Route('auth')
@Tags('Authentication')
export class AuthController extends Controller {

  /** Registers a new customer */
  @Post('register')
  @SuccessResponse('201', 'Created')
  @Response<StandardErrorResponse>(400, 'Bad Request')
  @Response<StandardErrorResponse>(409, 'Conflict - Email already exists')
  public async register(@Body() requestBody: RegisterRequest): Promise<AuthResponse> {
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
}
