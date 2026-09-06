import { User } from '../../models/User.js';
import { RefreshSession } from '../../models/RefreshSession.js';
import { Token } from '../../models/Token.js';
import { env } from '../../config/env.js';
import { badRequest, unauthorized } from '../../utils/errors.js';
import { hashToken, randomToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/tokens.js';

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, mobile: user.mobile, role: user.role, status: user.status, preferredLanguage: user.preferredLanguage, assignedCentreIds: user.assignedCentreIds });
export const normalizeIdentifier = (value) => {
  const normalized = String(value || '').trim();
  if (normalized.includes('@')) return { email: normalized.toLowerCase() };
  const digits = normalized.replace(/\D/g, '');
  return { mobile: digits.length > 10 ? digits.slice(-10) : digits };
};

export async function registerFarmer(input) {
  if (!input.email && !input.mobile) throw badRequest('Email or mobile is required');
  const passwordHash = await User.hashPassword(input.password);
  const user = await User.create({ ...input, email: input.email?.trim().toLowerCase() || undefined, mobile: input.mobile?.replace(/\D/g, '') || undefined, role: 'farmer', passwordHash, status: 'active' });
  return publicUser(user);
}

export async function login(input, metadata) {
  const user = await User.findOne({ ...normalizeIdentifier(input.identifier), status: { $ne: 'deleted' } }).select('+passwordHash');
  if (!user || !(await user.comparePassword(input.password))) throw unauthorized('Invalid credentials');
  if (user.status !== 'active') throw unauthorized('Account is not active');
  user.lastLoginAt = new Date(); await user.save();
  const sessionId = randomToken();
  const refreshToken = signRefreshToken(user, sessionId);
  await RefreshSession.create({ userId: user._id, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), ...metadata });
  return { user: publicUser(user), accessToken: signAccessToken(user), refreshToken };
}

export async function refresh(refreshToken, metadata) {
  if (!refreshToken) throw unauthorized('Refresh token is required');
  const payload = verifyRefreshToken(refreshToken);
  const session = await RefreshSession.findOne({ tokenHash: hashToken(refreshToken), userId: payload.sub, revokedAt: null });
  if (!session || session.expiresAt < new Date()) throw unauthorized('Refresh session is invalid');
  session.revokedAt = new Date(); await session.save();
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') throw unauthorized('Account is not active');
  const nextSessionId = randomToken(); const nextRefresh = signRefreshToken(user, nextSessionId);
  await RefreshSession.create({ userId: user._id, tokenHash: hashToken(nextRefresh), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), ...metadata });
  return { user: publicUser(user), accessToken: signAccessToken(user), refreshToken: nextRefresh };
}

export async function logout(refreshToken) { if (refreshToken) await RefreshSession.updateOne({ tokenHash: hashToken(refreshToken) }, { revokedAt: new Date() }); }
export async function logoutAll(userId) { await RefreshSession.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() }); await User.updateOne({ _id: userId }, { $inc: { refreshTokenVersion: 1 } }); }
export async function verifyEmail(rawToken) { const token = await Token.findOne({ tokenHash: hashToken(rawToken), type: 'email_verification', usedAt: null, expiresAt: { $gt: new Date() } }); if (!token) throw badRequest('Email verification token is invalid or expired'); await User.updateOne({ _id: token.userId }, { status: 'active', emailVerifiedAt: new Date() }); token.usedAt = new Date(); await token.save(); }

export async function bootstrapAdmin(input, secret) {
  if (!secret || secret !== env.bootstrapSecret) throw unauthorized('Bootstrap is not available');
  if (await User.exists({ role: 'admin' })) throw badRequest('An admin account already exists', 'ADMIN_ALREADY_EXISTS');
  const passwordHash = await User.hashPassword(input.password);
  return User.create({ name: input.name, email: input.email.trim().toLowerCase(), mobile: input.mobile?.replace(/\D/g, '') || undefined, passwordHash, role: 'admin', status: 'active', preferredLanguage: input.preferredLanguage || 'en' });
}
