import { Centre } from '../models/Centre.js';
import { Commodity } from '../models/Commodity.js';
import { notFound } from '../utils/errors.js';
import { pagination, paged } from '../utils/query.js';

export async function list(query) { const { page, limit, skip } = pagination(query); const filter = { status: query.status || 'active' }; if (query.district) filter.district = query.district; if (query.search) filter.$or = [{ name: new RegExp(query.search, 'i') }, { location: new RegExp(query.search, 'i') }]; const [items, total] = await Promise.all([Centre.find(filter).populate('supportedCommodityIds').sort({ name: 1 }).skip(skip).limit(limit), Centre.countDocuments(filter)]); return paged(items, total, page, limit); }
export async function get(id) { const item = await Centre.findById(id).populate('supportedCommodityIds'); if (!item) throw notFound('Centre not found'); return item; }
export async function create(input, actor) { return Centre.create({ ...input, createdBy: actor._id, updatedBy: actor._id }); }
export async function update(id, input, actor) { const item = await Centre.findByIdAndUpdate(id, { ...input, updatedBy: actor._id }, { new: true, runValidators: true }); if (!item) throw notFound('Centre not found'); return item; }
export async function setStatus(id, status, actor) { return update(id, { status }, actor); }
export async function validateCommodity(centreId, commodityId) { const centre = await Centre.findOne({ _id: centreId, status: 'active', supportedCommodityIds: commodityId }); const commodity = await Commodity.findOne({ _id: commodityId, active: true }); return Boolean(centre && commodity); }
