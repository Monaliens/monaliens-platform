import { Request, Response, NextFunction } from 'express';

interface LogData {
  method: string;
  url: string;
  status: number;
  responseTime: number;
  ip: string;
  userAgent?: string;
  contentLength?: number;
  timestamp: string;
}

export function logger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Skip rate limiting for allowed origins
  const origin = req.get('origin') || req.get('referer') || '';
  const allowedDomains = [
    process.env.FRONTEND_URL || 'https://your-domain',
    process.env.FRONTEND_URL_WWW || 'https://www.your-domain',
    process.env.API_URL || 'https://your-api-url',
    process.env.DEV_API_URL || 'https://dev.your-api-url',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const isAllowedOrigin = allowedDomains.some(domain => origin.startsWith(domain));
  if (isAllowedOrigin) {
    res.locals.skipRateLimit = true;
  }

  // Store original end function
  const originalEnd = res.end;

  // Override res.end to log response
  res.end = function(chunk?: any, encoding?: any): any {
    const responseTime = Date.now() - startTime;
    const contentLength = res.get('content-length');

    const logData: LogData = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      responseTime,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('user-agent'),
      contentLength: contentLength ? parseInt(contentLength) : undefined,
      timestamp,
    };

    // Color coding for different status codes
    const statusColor = getStatusColor(res.statusCode);
    const methodColor = getMethodColor(req.method);

    console.log(
      `${timestamp} ${methodColor}${req.method}${'\x1b[0m'} ${req.originalUrl || req.url} ` +
      `${statusColor}${res.statusCode}${'\x1b[0m'} ${responseTime}ms ` +
      `${logData.ip}${logData.userAgent ? ` "${logData.userAgent}"` : ''}`
    );

    // Log errors with more detail
    if (res.statusCode >= 400) {
      console.error(` Error ${res.statusCode}: ${req.method} ${req.originalUrl}`);
    }

    // Call original end function
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}

function getStatusColor(status: number): string {
  if (status >= 500) return '\x1b[31m'; // Red
  if (status >= 400) return '\x1b[33m'; // Yellow
  if (status >= 300) return '\x1b[36m'; // Cyan
  if (status >= 200) return '\x1b[32m'; // Green
  return '\x1b[37m'; // White
}

function getMethodColor(method: string): string {
  switch (method) {
    case 'GET': return '\x1b[32m';    // Green
    case 'POST': return '\x1b[34m';   // Blue
    case 'PUT': return '\x1b[33m';    // Yellow
    case 'DELETE': return '\x1b[31m'; // Red
    case 'PATCH': return '\x1b[35m';  // Magenta
    default: return '\x1b[37m';       // White
  }
}

/**
 * Enhanced logger with structured logging for production
 */
export function structuredLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  const timestamp = Date.now();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds

    const logEntry = {
      timestamp: new Date(timestamp).toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      responseTime: Math.round(duration * 100) / 100, // Round to 2 decimal places
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      contentLength: res.get('content-length'),
      level: res.statusCode >= 400 ? 'error' : 'info',
    };

    if (process.env.NODE_ENV === 'production') {
      // In production, use structured JSON logging
      console.log(JSON.stringify(logEntry));
    } else {
      // In development, use colored console output
      logger(req, res, () => {});
    }
  });

  next();
} 