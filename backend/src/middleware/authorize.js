import { forbidden } from '../utils/errors.js';

export const authorize = (...roles) => (request, response, next) => {
  if (!request.user || !roles.includes(request.user.role)) return next(forbidden());
  next();
};
