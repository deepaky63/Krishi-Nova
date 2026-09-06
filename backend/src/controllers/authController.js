import { env } from '../config/env.js';
import * as authService from '../services/auth/authService.js';
import { success } from '../utils/response.js';

const cookieOptions = () => ({ httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/auth' });
const metadata = (request) => ({ ipAddress: request.ip, userAgent: request.get('user-agent') });

export async function register(request, response) { const user = await authService.registerFarmer(request.body); return success(response, { user }, 201); }
export async function login(request, response) { const result = await authService.login(request.body, metadata(request)); response.cookie('refreshToken', result.refreshToken, cookieOptions()); return success(response, { user: result.user, accessToken: result.accessToken }); }
export async function refresh(request, response) { const result = await authService.refresh(request.cookies.refreshToken, metadata(request)); response.cookie('refreshToken', result.refreshToken, cookieOptions()); return success(response, { user: result.user, accessToken: result.accessToken }); }
export async function logout(request, response) { await authService.logout(request.cookies.refreshToken); response.clearCookie('refreshToken', { ...cookieOptions(), maxAge: undefined }); return success(response, null); }
export async function logoutAll(request, response) { await authService.logoutAll(request.user._id); response.clearCookie('refreshToken', { ...cookieOptions(), maxAge: undefined }); return success(response, null); }
export async function me(request, response) { return success(response, { user: request.user }); }
export async function verifyEmail(request, response) { await authService.verifyEmail(request.body.token); return success(response, null); }
export async function bootstrapAdmin(request, response) { const user = await authService.bootstrapAdmin(request.body, request.get('x-bootstrap-secret')); return success(response, { id: user._id, role: user.role }, 201); }
