import { Commodity } from '../models/Commodity.js';
import { notFound } from '../utils/errors.js';

export const list = () => Commodity.find({ active: true }).sort({ name: 1 });
export const listAll = () => Commodity.find().sort({ name: 1 });
export const create = (input, actor) => Commodity.create({ ...input, createdBy: actor._id, updatedBy: actor._id });
export async function update(id, input, actor) { const item = await Commodity.findByIdAndUpdate(id, { ...input, updatedBy: actor._id }, { new: true, runValidators: true }); if (!item) throw notFound('Commodity not found'); return item; }
