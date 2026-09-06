import mongoose from 'mongoose';

const operatingHourSchema = new mongoose.Schema({ day: { type: Number, min: 0, max: 6, required: true }, open: String, close: String, closed: { type: Boolean, default: false } }, { _id: false });
const closureSchema = new mongoose.Schema({ date: { type: Date, required: true }, startTime: String, endTime: String, reason: String, closureType: { type: String, enum: ['holiday', 'temporary'], required: true }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });

const centreSchema = new mongoose.Schema({
  centreCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true }, description: String, address: { type: String, required: true }, villageTown: String, district: { type: String, required: true }, state: { type: String, required: true }, pincode: String,
  location: { latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 } }, contactPhone: String, contactEmail: String,
  operatingHours: [operatingHourSchema], supportedCommodityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Commodity' }], assignedStaffIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true }, closures: [closureSchema], createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
centreSchema.index({ district: 1, state: 1, status: 1 });
export const Centre = mongoose.model('Centre', centreSchema);
