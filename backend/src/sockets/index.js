import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { QueueEntry } from '../models/QueueEntry.js';
import { Booking } from '../models/Booking.js';

let ioInstance;
export function emitQueueUpdate(entry) {
  if (!ioInstance) return;
  const dateStr = entry.queueDate ? new Date(entry.queueDate).toISOString().split('T')[0] : '';
  const centreIdStr = (entry.centreId?._id || entry.centreId).toString();
  const slotIdStr = (entry.slotId?._id || entry.slotId).toString();
  
  // Emit to both ISO-date room and raw date room for compatibility
  ioInstance.to(`queue:${centreIdStr}:${dateStr}:${slotIdStr}`).emit('queue:status-changed', entry);
  ioInstance.to(`queue:${entry.centreId}:${entry.queueDate}:${entry.slotId}`).emit('queue:status-changed', entry);
}

export function attachSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.frontendOrigins, credentials: true } });
  ioInstance = io;
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub);
      if (!user || user.status !== 'active') return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`);
    if (socket.user.role === 'admin') socket.join('admin:operations');

    socket.on('queue:join', async ({ centreId, date, slotId, bookingId }) => {
      const cId = centreId?.toString();
      const sId = slotId?.toString();
      const dateStr = date ? new Date(date).toISOString().split('T')[0] : '';

      const assigned =
        socket.user.role === 'admin' ||
        (socket.user.assignedCentreIds || []).some(
          (id) => (id._id || id).toString() === cId
        );

      let ownsBooking = false;
      if (socket.user.role === 'farmer' && bookingId) {
        ownsBooking =
          (await QueueEntry.exists({ bookingId, farmerId: socket.user._id })) ||
          (await Booking.exists({ _id: bookingId, farmerId: socket.user._id }));
      }

      if (assigned || ownsBooking) {
        if (dateStr) {
          socket.join(`queue:${cId}:${dateStr}:${sId}`);
        }
        socket.join(`queue:${centreId}:${date}:${slotId}`);
      }
    });

    socket.on('queue:leave', ({ centreId, date, slotId }) => {
      const cId = centreId?.toString();
      const sId = slotId?.toString();
      const dateStr = date ? new Date(date).toISOString().split('T')[0] : '';
      if (dateStr) {
        socket.leave(`queue:${cId}:${dateStr}:${sId}`);
      }
      socket.leave(`queue:${centreId}:${date}:${slotId}`);
    });
  });
  return io;
}
