import mongoose from 'mongoose';

const commoditySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, code: { type: String, required: true, unique: true, uppercase: true, trim: true }, description: String,
  quantityUnit: { type: String, default: 'kg' }, active: { type: Boolean, default: true, index: true }, qualityParameters: [{ key: String, label: String, type: { type: String, enum: ['number', 'text', 'select'] }, required: Boolean }], rejectionReasons: [{ type: String, trim: true }], createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
export const Commodity = mongoose.model('Commodity', commoditySchema);
