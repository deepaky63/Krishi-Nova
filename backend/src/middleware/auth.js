import { User } from '../models/User.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { unauthorized } from '../utils/errors.js';

export async function authenticate(request, response, next) {
  try {
    const header = request.get('authorization');
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    const payload = verifyAccessToken(header.slice(7));
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') throw unauthorized('Account is not active');
    request.user = user;
    next();
  } catch (error) { next(error.statusCode ? error : unauthorized('Invalid or expired access token')); }
}

export const optionalAuth = async (request, response, next) => {
  const header = request.get('authorization');
  if (!header?.startsWith('Bearer ')) return next();
  return authenticate(request, response, next);
};
