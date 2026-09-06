import { Centre } from '../models/Centre.js';
import { Slot } from '../models/Slot.js';
import { notFound, badRequest } from '../utils/errors.js';

const minutes = (time) => { const match = String(time).match(/^(\d{1,2}):(\d{2})$/); if (!match) return NaN; return Number(match[1]) * 60 + Number(match[2]); };
export async function assertNoOverlap(input, excludeId) { const existing = await Slot.find({ centreId: input.centreId, date: input.date, active: true, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); const start = minutes(input.startTime); const end = minutes(input.endTime); if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw badRequest('startTime must be earlier than endTime'); if (existing.some((slot) => start < minutes(slot.endTime) && end > minutes(slot.startTime))) throw badRequest('Slot overlaps an existing active slot', 'SLOT_OVERLAP'); }
export async function list(query) { const filter = {}; if (query.centreId) filter.centreId = query.centreId; if (query.date) filter.date = new Date(query.date); if (query.active !== undefined) filter.active = query.active === 'true'; return Slot.find(filter).populate('centreId commodityIds').sort({ date: 1, startTime: 1 }); }
export async function get(id) { const slot = await Slot.findById(id).populate('centreId commodityIds'); if (!slot) throw notFound('Slot not found'); return slot; }
export async function create(input, actor) { await assertNoOverlap(input); const centre = await Centre.findOne({ _id: input.centreId, status: 'active' }); if (!centre) throw badRequest('Centre is not active'); return Slot.create({ ...input, createdBy: actor._id, updatedBy: actor._id }); }
export async function update(id, input, actor) { const current = await Slot.findById(id); if (!current) throw notFound('Slot not found'); await assertNoOverlap({ ...current.toObject(), ...input }, id); return Slot.findByIdAndUpdate(id, { ...input, updatedBy: actor._id }, { new: true, runValidators: true }); }
