import { badRequest } from '../utils/errors.js';

export const validate = (schema, source = 'body') => (request, response, next) => {
  const result = schema.safeParse(request[source]);
  if (!result.success) return next(badRequest('Request validation failed', 'VALIDATION_ERROR', result.error.issues));
  request[source] = result.data;
  next();
};
