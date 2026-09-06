import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const socketUrl = apiUrl.replace(/\/api\/?$/, '');

export const connectQueueSocket = (token, handlers = {}) => {
  const socket = io(socketUrl, { auth: { token }, withCredentials: true, autoConnect: Boolean(token) });
  if (handlers.updated) socket.on('queue:status-changed', handlers.updated);
  return socket;
};