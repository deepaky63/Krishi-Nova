import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';
import { failure } from '../utils/response.js';

export function notFoundHandler(request, response) { failure(response, `Route not found: ${request.method} ${request.originalUrl}`, 'ROUTE_NOT_FOUND', 404); }

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  let appError = error;
  if (error instanceof mongoose.Error.ValidationError) appError = new AppError('Validation failed', 400, 'VALIDATION_ERROR', Object.values(error.errors).map((item) => item.message));
  if (error.code === 11000) {
    let message = 'A record with those unique fields already exists';
    if (error.keyPattern?.mobile) message = 'An account with this mobile number already exists.';
    else if (error.keyPattern?.email) message = 'An account with this email already exists.';
    appError = new AppError(message, 409, 'DUPLICATE_RECORD');
  }
  if (error.name === 'CastError') appError = new AppError('Invalid resource identifier', 400, 'INVALID_ID');
  const status = appError.statusCode || 500;
  if (status >= 500) console.error(error);
  return failure(response, appError.message || 'Internal server error', appError.code || 'INTERNAL_ERROR', status, appError.details);
}
