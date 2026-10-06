import { Request, Response, NextFunction } from 'express';
import { MiddlewareError } from '../interfaces/error.interface.js';

export const errorHandler = (
  err: MiddlewareError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. TSOA Validation Errors
  if (err?.fields || err?.status === 400) {
    res.status(400).json({
      success: false,
      message: 'Validation Failed',
      data: err.fields,
    });
    return;
  }

  // 2. Zod Validation Errors
  if (err?.name === 'ZodError' || err?.errors) {
    res.status(400).json({
      success: false,
      message: 'Validation Error',
      data: err.issues ?? err.errors,
    });
    return;
  }

  // 3. Custom App Errors (AppError)
  if (err?.statusCode) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
    });
    return;
  }

  // 4. Prisma Database Errors
  if (err?.code === 'P2002') {
    res.status(409).json({
      success: false,
      message: 'A record with this unique value already exists.',
      data: null,
    });
    return;
  }

  if (err?.code === 'P2025') {
    res.status(404).json({
      success: false,
      message: 'Requested record not found.',
      data: null,
    });
    return;
  }

  // 5. Default Server Error
  console.error('[Internal Error]:', err);
  res.status(500).json({
    success: false,
    message: err?.message || 'Internal Server Error',
    data: null,
  });
};