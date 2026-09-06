import mongoose from 'mongoose';
import { forbidden, badRequest } from '../utils/errors.js';

export function requireCentreAccess(source = 'params', field = 'centreId') {
  return (request, response, next) => {
    const rawId = request[source]?.[field];
    if (!mongoose.isValidObjectId(rawId)) return next(badRequest('Invalid centre identifier', 'INVALID_ID'));
    if (request.user.role === 'admin' || request.user.assignedCentreIds.some((id) => id.toString() === rawId)) return next();
    return next(forbidden('You are not assigned to this procurement centre'));
  };
}
