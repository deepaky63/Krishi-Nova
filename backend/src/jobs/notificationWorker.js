import { WhatsAppDelivery } from '../models/WhatsAppDelivery.js';
import { processWhatsAppDelivery } from '../services/whatsapp/whatsappService.js';

export async function processPendingNotifications() {
  const pending = await WhatsAppDelivery.find({ status: 'queued', attemptCount: { $lt: 5 }, $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: new Date() } }] }).limit(20);
  for (const delivery of pending) await processWhatsAppDelivery(delivery);
}
