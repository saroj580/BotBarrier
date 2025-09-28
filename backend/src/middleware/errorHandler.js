import { initConfig } from '../config/index.js';
import { SuspiciousLog } from '../models/SuspiciousLog.js';

const config = initConfig();

export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400);
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429);
  }
}

async function logError(error, req, res) {
  try {
    const logData = {
      error: {
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode || 500,
        timestamp: new Date().toISOString()
      },
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id
      },
      environment: process.env.NODE_ENV
    };

    if (process.env.NODE_ENV !== 'production') {
      console.error('Error occurred:', logData);
    }

    if (error.statusCode >= 400 && error.statusCode < 500) {
      await SuspiciousLog.create({
        ip: req.ip,
        userId: req.user?.id || null,
        userAgent: req.get('user-agent') || '',
        path: req.path,
        method: req.method,
        reason: 'error_' + error.statusCode,
        score: 0.1, // Low score for errors
        meta: {
          errorType: error.constructor.name,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
}

export function errorHandler(error, req, res, next) {
  logError(error, req, res);

  let statusCode = error.statusCode || 500;
  let message = 'Internal server error';
  let details = null;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    if (error.details) {
      details = error.details;
    }
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = error.details || error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  } else if (error.name === 'MongoError' && error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  const response = {
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString()
    }
  };

  if (details && process.env.NODE_ENV !== 'production') {
    response.error.details = details;
  }

  if (req.requestId) {
    response.error.requestId = req.requestId;
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers['x-request-id'] || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('x-request-id', req.requestId);
  next();
}
