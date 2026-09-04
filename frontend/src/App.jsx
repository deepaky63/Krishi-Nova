import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout, PublicLayout } from './components/Layout';
import { AboutPage, CentresPage, ContactPage, HomePage, HowItWorksPage } from './pages/PublicPages';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { BookingPage, BookSlotPage, FarmerDashboard, FarmerProfilePage, NotificationsPage, PaymentPage, ProcurementPage, QueuePage } from './pages/FarmerPages';
import { StaffBookingsPage, StaffDashboard, StaffQueuePage } from './pages/StaffPages';
import { AdminAnalyticsPage, AdminCentresPage, AdminDashboard, AdminPlaceholderPage } from './pages/AdminPages';

export default function App() {
  return <Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/centres" element={<CentresPage />} />
      <Route path="/contact" element={<ContactPage />} />
    </Route>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<DashboardLayout role="farmer" />}>
      <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
      <Route path="/farmer/book-slot" element={<BookSlotPage />} />
      <Route path="/farmer/booking" element={<BookingPage />} />
      <Route path="/farmer/queue" element={<QueuePage />} />
      <Route path="/farmer/procurement" element={<ProcurementPage />} />
      <Route path="/farmer/payment" element={<PaymentPage />} />
      <Route path="/farmer/notifications" element={<NotificationsPage />} />
      <Route path="/farmer/profile" element={<FarmerProfilePage />} />
    </Route>
    <Route element={<DashboardLayout role="staff" />}>
      <Route path="/staff/dashboard" element={<StaffDashboard />} />
      <Route path="/staff/queue" element={<StaffQueuePage />} />
      <Route path="/staff/bookings" element={<StaffBookingsPage />} />
    </Route>
    <Route element={<DashboardLayout role="admin" />}>
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/centres" element={<AdminCentresPage />} />
      <Route path="/admin/schedules" element={<AdminPlaceholderPage type="schedules" />} />
      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
      <Route path="/admin/staff" element={<AdminPlaceholderPage type="staff" />} />
      <Route path="/admin/settings" element={<AdminPlaceholderPage type="settings" />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
