import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i);
export const centreSchema = z.object({ centreCode: z.string().min(2), name: z.string().min(2), address: z.string().min(2), district: z.string().min(2), state: z.string().min(2), pincode: z.string().optional(), status: z.enum(['active', 'inactive']).optional(), supportedCommodityIds: z.array(id).optional(), operatingHours: z.array(z.object({ day: z.number().int().min(0).max(6), open: z.string().optional(), close: z.string().optional(), closed: z.boolean().optional() })).optional() });
export const commoditySchema = z.object({ name: z.string().min(2), code: z.string().min(2), description: z.string().optional(), quantityUnit: z.string().default('kg'), active: z.boolean().optional(), qualityParameters: z.array(z.object({ key: z.string(), label: z.string(), type: z.enum(['number', 'text', 'select']), required: z.boolean().optional() })).optional(), rejectionReasons: z.array(z.string()).optional() });
export const slotSchema = z.object({ centreId: id, commodityIds: z.array(id).min(1), date: z.coerce.date(), startTime: z.string(), endTime: z.string(), maxFarmers: z.number().int().positive(), maxQuantity: z.number().positive().optional(), bookingCutoffMinutes: z.number().int().nonnegative().optional(), active: z.boolean().optional() });
export const bookingSchema = z.object({ centreId: id, slotId: id, commodityId: id, bookedQuantity: z.number().positive(), quantityUnit: z.string().default('kg') });
export const cancelSchema = z.object({ reason: z.string().max(500).optional() });
export const queueStatusSchema = z.object({ status: z.enum(['waiting', 'checked_in', 'processing', 'served', 'skipped', 'cancelled', 'no_show']) });
export const skipSchema = z.object({ reason: z.string().min(2).max(500) });
