import * as express from 'express';
import { verifyToken } from './jwt';
import { JwtPayload } from '../interfaces/auth.interface';
import { AppError } from '../utils/appError';

export function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[]
): Promise<JwtPayload> {
  if (securityName === 'jwt') {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Promise.reject(new AppError('Unauthorized: Missing token header', 401));
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = verifyToken(token);

      // Enforce role-based scopes specified in TSOA decorator e.g. @Security('jwt', ['ADMIN'])
      if (scopes && scopes.length > 0) {
        if (!scopes.includes(decoded.role)) {
          return Promise.reject(new AppError('Forbidden: Insufficient permissions', 403));
        }
      }

      return Promise.resolve(decoded);
    } catch {
      return Promise.reject(new AppError('Unauthorized: Invalid or expired token', 401));
    }
  }

  return Promise.reject(new AppError('Unauthorized: Unsupported security method', 401));
}