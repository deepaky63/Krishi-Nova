import * as service from '../services/notificationService.js';
import { success } from '../utils/response.js';
export const list = async (req, res) => success(res, await service.listForUser(req.user._id));
export const markRead = async (req, res) => success(res, await service.markRead(req.params.id, req.user._id));
export const markAllRead = async (req, res) => success(res, await service.markAllRead(req.user._id));
