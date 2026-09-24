import { Controller, Route, Post, Get, Body, SuccessResponse, Response, Tags, Security, Request } from 'tsoa';
import express from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterRequest, LoginRequest, AuthResponse, AuthUserData } from '../interfaces/auth.interface';
import { JwtPayload } from '../config/jwt';

const authService = new AuthService();

@Route('auth')
@Tags('Authentication')
export class AuthController extends Controller {

  /** Registers a new customer */
  @Post('register')
  @SuccessResponse('201', 'Created')
  @Response(400, 'Bad Request')
  @Response(409, 'Conflict - Email already exists')
  public async register(@Body() requestBody: RegisterRequest): Promise<AuthResponse> {
    const result = await authService.register(requestBody);
    this.setStatus(201);
    return result;
  }

  /** Authenticates a user (CUSTOMER or ADMIN). Role is returned in the response. */
  @Post('login')
  @SuccessResponse('200', 'Success')
  @Response(400, 'Bad Request')
  @Response(401, 'Unauthorized')
  public async login(@Body() requestBody: LoginRequest): Promise<AuthResponse> {
    return authService.login(requestBody);
  }

  /** Returns the current authenticated user profile */
  @Get('me')
  @Security('jwt')
  @SuccessResponse('200', 'Success')
  @Response(401, 'Unauthorized')
  public async getMe(@Request() request: express.Request): Promise<{ success: boolean; data: AuthUserData }> {
    return authService.getMe((request as any).user as JwtPayload);
  }
}
