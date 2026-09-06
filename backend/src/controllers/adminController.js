import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { Centre } from '../models/Centre.js';
import { success } from '../utils/response.js';

export const dashboard = async (req, res) => success(res, { totalCentres: await Centre.countDocuments({ status: 'active' }), totalFarmers: await User.countDocuments({ role: 'farmer', status: 'active' }), activeBookings: await Booking.countDocuments({ status: { $in: ['booked', 'checked_in', 'quality_check', 'weighed'] } }) });
export const listUsers = async (req, res) => success(res, await User.find({ role: req.query.role || { $in: ['farmer', 'staff'] }, status: { $ne: 'deleted' } }).select('-passwordHash').limit(100));
export const listStaff = async (req, res) => success(res, await User.find({ role: 'staff', status: { $ne: 'deleted' } }).select('-passwordHash').populate('assignedCentreIds', 'name centreCode district address').sort({ name: 1 }));
export const createStaff = async (req, res) => {
	const centreCount = await Centre.countDocuments({ _id: { $in: req.body.assignedCentreIds }, status: { $in: ['active', 'inactive'] } });
	if (centreCount !== req.body.assignedCentreIds.length) return res.status(400).json({ success: false, message: 'One or more assigned centres are invalid', code: 'INVALID_CENTRE_ASSIGNMENT' });
	const passwordHash = await User.hashPassword(req.body.password);
	const user = await User.create({ name: req.body.name, email: req.body.email.trim().toLowerCase(), mobile: req.body.mobile.replace(/\D/g, ''), passwordHash, role: 'staff', status: 'active', assignedCentreIds: req.body.assignedCentreIds, preferredLanguage: req.body.preferredLanguage });
	return success(res, { user: await User.findById(user._id).select('-passwordHash').populate('assignedCentreIds', 'name centreCode district address') }, 201);
};
export const updateStaff = async (req, res) => {
	const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
	if (!staff) return res.status(404).json({ success: false, message: 'Staff account not found', code: 'STAFF_NOT_FOUND' });
	if (req.body.assignedCentreIds) {
		const centreCount = await Centre.countDocuments({ _id: { $in: req.body.assignedCentreIds }, status: { $in: ['active', 'inactive'] } });
		if (centreCount !== req.body.assignedCentreIds.length) return res.status(400).json({ success: false, message: 'One or more assigned centres are invalid', code: 'INVALID_CENTRE_ASSIGNMENT' });
	}
	const update = { ...req.body };
	if (update.email) update.email = update.email.trim().toLowerCase();
	if (update.mobile) update.mobile = update.mobile.replace(/\D/g, '');
	const updated = await User.findByIdAndUpdate(staff._id, { $set: update }, { new: true, runValidators: true }).select('-passwordHash').populate('assignedCentreIds', 'name centreCode district address');
	return success(res, { user: updated });
};
