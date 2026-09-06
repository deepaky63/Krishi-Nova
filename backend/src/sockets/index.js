import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { QueueEntry } from '../models/QueueEntry.js';

let ioInstance;
export function emitQueueUpdate(entry) { if (!ioInstance) return; ioInstance.to(`queue:${entry.centreId}:${entry.queueDate}:${entry.slotId}`).emit('queue:status-changed', entry); }
export function attachSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.frontendOrigins, credentials: true } });
  ioInstance = io;
  io.use(async (socket, next) => { try { const token = socket.handshake.auth?.token; const payload = verifyAccessToken(token); const user = await User.findById(payload.sub); if (!user || user.status !== 'active') return next(new Error('Unauthorized')); socket.user = user; next(); } catch { next(new Error('Unauthorized')); } });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`);
    if (socket.user.role === 'admin') socket.join('admin:operations');
    socket.on('queue:join', async ({ centreId, date, slotId, bookingId }) => { const assigned = socket.user.role === 'admin' || socket.user.assignedCentreIds.some((id) => id.toString() === centreId); const ownsBooking = socket.user.role === 'farmer' && bookingId && await QueueEntry.exists({ bookingId, farmerId: socket.user._id, centreId, slotId }); if (assigned || ownsBooking) socket.join(`queue:${centreId}:${date}:${slotId}`); });
    socket.on('queue:leave', ({ centreId, date, slotId }) => socket.leave(`queue:${centreId}:${date}:${slotId}`));
  });
  return io;
}
