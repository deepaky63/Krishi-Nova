import axios from 'axios';
import { centres } from '../data/centres';
import { slots } from '../data/slots';
import { queueTokens } from '../data/queue';
import { notifications } from '../data/notifications';
import { staffQueue, arrivals } from '../data/dashboard';

export const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api' });
const simulate = (data) => new Promise((resolve) => setTimeout(() => resolve(data), 220));

// Replace simulate(...) calls with client requests when the Node/Express API is connected.
export const api = {
  loginUser: (payload) => simulate({ user: { name: 'Ramesh Kumar', role: payload.role || 'farmer' }, token: 'demo-token' }),
  registerFarmer: (payload) => simulate({ ...payload, id: 'KNF-2026-8421' }),
  getCentres: () => simulate(centres),
  getCentreById: (id) => simulate(centres.find((centre) => centre.id === id) || centres[0]),
  getAvailableSlots: () => simulate(slots),
  getRecommendedSlot: () => simulate(slots.find((slot) => slot.recommended)),
  createBooking: (payload) => simulate({ id: 'KN-2026-1024', token: 'P1024', ...payload }),
  getBooking: () => simulate({ id: 'KN-2026-1024', token: 'P1024', time: '12:00 – 1:00 PM' }),
  getQueue: () => simulate(queueTokens),
  getProcurementStatus: () => simulate({ status: 'Weighing', updatedAt: '10 Sep, 11:38 AM' }),
  getPaymentStatus: () => simulate({ amount: 42500, status: 'Payment Initiated' }),
  getNotifications: () => simulate(notifications),
  getStaffDashboard: () => simulate({ queue: staffQueue, capacity: 78 }),
  getAdminDashboard: () => simulate({ arrivals, totalCentres: 28, activeQueues: 19 }),
};
