import { WhatsAppDelivery } from '../../models/WhatsAppDelivery.js';

export async function whatsappDelivery(input) {
  return WhatsAppDelivery.create({ ...input, status: 'queued', attemptCount: 0 });
}

export async function processWhatsAppDelivery(delivery) {
  // Provider calls belong here once approved Meta templates and credentials are configured.
  delivery.status = 'failed';
  delivery.failureReason = 'WhatsApp provider is not configured';
  delivery.attemptCount += 1;
  await delivery.save();
  return delivery;
}
