import { Notification } from '../models/Notification.js';
import { env } from '../config/env.js';
import { whatsappDelivery } from './whatsapp/whatsappService.js';

export async function createInApp({ userId, type, title, message, language = 'en', relatedEntityType, relatedEntityId, whatsapp = false }) {
  const notification = await Notification.create({ userId, type, title, message, language, relatedEntityType, relatedEntityId, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) });
  if (whatsapp && env.whatsappEnabled) await whatsappDelivery({ userId, type, language, relatedEntityType, relatedEntityId });
  return notification;
}
export const listForUser = (userId) => Notification.find({ userId }).sort({ createdAt: -1 }).limit(100);
export const markRead = (id, userId) => Notification.findOneAndUpdate({ _id: id, userId }, { readAt: new Date() }, { new: true });
export const markAllRead = (userId) => Notification.updateMany({ userId, readAt: null }, { readAt: new Date() });
