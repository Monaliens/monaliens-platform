import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, NotFoundError } from '../types';

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
  });

  if (error instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: error.message,
      details: error.details,
      code: error.code,
      timestamp: Date.now(),
    });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: Date.now(),
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: Date.now(),
    });
    return;
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
    timestamp: Date.now(),
  });
}
