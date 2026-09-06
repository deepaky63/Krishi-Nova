import { z } from 'zod';

const password = z.string().min(8).max(128);
const optionalEmail = z.preprocess((value) => value === '' ? undefined : value, z.string().email().optional());
const optionalMobile = z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^\d{10}$/).optional());
export const registerSchema = z.object({ name: z.string().trim().min(2).max(120), email: optionalEmail, mobile: optionalMobile, password, preferredLanguage: z.enum(['en', 'hi']).optional() }).refine((value) => value.email || value.mobile, { message: 'Email or mobile is required', path: ['identifier'] });
export const loginSchema = z.object({ identifier: z.string().min(3), password });
export const verifyEmailSchema = z.object({ token: z.string().min(20) });
export const adminBootstrapSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email(), mobile: z.string().regex(/^\d{10}$/).optional(), password });
