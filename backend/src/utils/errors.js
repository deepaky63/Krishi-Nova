export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = 'Resource not found', code = 'NOT_FOUND') => new AppError(message, 404, code);
export const badRequest = (message, code = 'BAD_REQUEST', details) => new AppError(message, 400, code, details);
export const unauthorized = (message = 'Authentication required') => new AppError(message, 401, 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have permission to perform this action') => new AppError(message, 403, 'FORBIDDEN');
