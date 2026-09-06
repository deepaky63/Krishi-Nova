import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');
const password = z.string().min(8).max(128);

export const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  mobile: z.string().regex(/^\d{10}$/),
  password,
  preferredLanguage: z.enum(['en', 'hi']).default('en'),
  assignedCentreIds: z.array(objectId).default([]),
});

export const updateStaffSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().optional(),
  mobile: z.string().regex(/^\d{10}$/).optional(),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
  assignedCentreIds: z.array(objectId).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one staff field is required' });