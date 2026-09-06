import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({ actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, actorRole: String, action: { type: String, required: true }, entityType: { type: String, required: true }, entityId: mongoose.Schema.Types.ObjectId, centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', index: true }, before: mongoose.Schema.Types.Mixed, after: mongoose.Schema.Types.Mixed, reason: String, ipAddress: String, userAgent: String }, { timestamps: true });
auditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', auditSchema);
