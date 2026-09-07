import axios from 'axios';

export const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', withCredentials: true });
let accessToken = null;
let refreshPromise = null;
export const setAccessToken = (token) => { accessToken = token; };
export const clearAccessToken = () => { accessToken = null; };
export const getAccessToken = () => accessToken;
client.interceptors.request.use((config) => { if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`; return config; });
client.interceptors.response.use((response) => response, async (error) => { const original = error.config; if (error.response?.status !== 401 || original?._retry || original?.url?.includes('/auth/')) throw error; original._retry = true; refreshPromise ||= client.post('/auth/refresh').then(({ data }) => { accessToken = data.data.accessToken; return accessToken; }).finally(() => { refreshPromise = null; }); await refreshPromise; return client(original); });
const unwrap = ({ data }) => data.data;

export const api = {
  loginUser: async (payload) => { const result = await client.post('/auth/login', payload).then(unwrap); accessToken = result.accessToken; return result; },
  registerFarmer: (payload) => client.post('/auth/register', payload).then(unwrap),
  refreshSession: async () => { const result = await client.post('/auth/refresh').then(unwrap); accessToken = result.accessToken; return result; },
  logout: async (allDevices = false) => { await client.post(`/auth/${allDevices ? 'logout-all' : 'logout'}`); accessToken = null; },
  getMe: () => client.get('/auth/me').then(unwrap),
  getCentres: (params) => client.get('/centres', { params }).then(unwrap),
  getCentreById: (id) => client.get(`/centres/${id}`).then(unwrap),
  getCommodities: () => client.get('/commodities').then(unwrap),
  getAvailableSlots: (params) => client.get('/slots', { params }).then(unwrap),
  getAdminSlots: (params) => client.get('/admin/slots', { params }).then(unwrap),
  getSlot: (id) => client.get(`/slots/${id}`).then(unwrap),
  createBooking: (payload) => client.post('/bookings', payload).then(unwrap),
  getMyBookings: () => client.get('/bookings/my').then(unwrap),
  getBooking: (id) => client.get(`/bookings/${id}`).then(unwrap),
  cancelBooking: (id, reason) => client.post(`/bookings/${id}/cancel`, { reason }).then(unwrap),
  getQueue: (params) => client.get('/staff/queue', { params }).then(unwrap),
  getBookingQueue: (bookingId) => client.get(`/bookings/${bookingId}/queue`).then(unwrap),
  checkIn: (bookingId) => client.post(`/staff/bookings/${bookingId}/check-in`).then(unwrap),
  updateQueueStatus: (id, status) => client.patch(`/staff/queue/${id}/status`, { status }).then(unwrap),
  skipQueue: (id, reason) => client.post(`/staff/queue/${id}/skip`, { reason }).then(unwrap),
  getProcurementStatus: (bookingId) => client.get(`/procurements/${bookingId}`).then(unwrap),
  getPaymentStatus: (bookingId) => client.get(`/procurements/${bookingId}/settlement`).then(unwrap),
  getNotifications: () => client.get('/notifications').then(unwrap),
  markNotificationRead: (id) => client.patch(`/notifications/${id}/read`).then(unwrap),
  markAllNotificationsRead: () => client.patch('/notifications/read-all').then(unwrap),
  getAdminDashboard: () => client.get('/admin/dashboard').then(unwrap),
  getStaffUsers: () => client.get('/admin/users/staff').then(unwrap),
  createStaff: (payload) => client.post('/admin/users/staff', payload).then(unwrap),
  updateStaff: (id, payload) => client.patch(`/admin/users/staff/${id}`, payload).then(unwrap),
  createCentre: (payload) => client.post('/admin/centres', payload).then(unwrap),
  updateCentre: (id, payload) => client.patch(`/admin/centres/${id}`, payload).then(unwrap),
  setCentreStatus: (id, status) => client.patch(`/admin/centres/${id}/status`, { status }).then(unwrap),
  createSlot: (payload) => client.post('/admin/slots', payload).then(unwrap),
  updateSlot: (id, payload) => client.patch(`/admin/slots/${id}`, payload).then(unwrap),
  previewSchedule: (payload) => client.post('/admin/schedules/preview', payload).then(unwrap),
  createSchedule: (payload) => client.post('/admin/schedules', payload).then(unwrap),
  getAdminSchedules: (params) => client.get('/admin/schedules', { params }).then(unwrap),
  getAdminSchedule: (id) => client.get(`/admin/schedules/${id}`).then(unwrap),
  getAdminScheduleSlots: (id, params) => client.get(`/admin/schedules/${id}/slots`, { params }).then(unwrap),
  setScheduleStatus: (id, active) => client.patch(`/admin/schedules/${id}/status`, { active }).then(unwrap),
  getStaffDashboard: (params) => client.get('/staff/dashboard', { params }).then(unwrap),
  getStaffBookings: (params) => client.get('/staff/bookings', { params }).then(unwrap),

};
