import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardLayout, PublicLayout } from './components/Layout';
import { AboutPage, CentresPage, ContactPage, HomePage, HowItWorksPage } from './pages/PublicPages';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { BookingPage, BookSlotPage, FarmerDashboard, FarmerProfilePage, NotificationsPage, PaymentPage, ProcurementPage, QueuePage } from './pages/FarmerPages';
import { StaffBookingsPage, StaffDashboard, StaffQueuePage } from './pages/StaffPages';
import { AdminAnalyticsPage, AdminCentresPage, AdminDashboard, AdminPlaceholderPage, AdminSchedulesPage, AdminStaffPage } from './pages/AdminPages';
import { LoadingSpinner } from './components/UI';
import { useApp } from './context/AppContext';

const roleDashboard = { farmer: '/farmer/dashboard', staff: '/staff/dashboard', admin: '/admin/dashboard' };

function ProtectedRoute({ role, children }) {
  const { user, authLoading } = useApp();
  const location = useLocation();
  if (authLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to={`/login?role=${role}&returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}/dashboard`} replace />;
  return children;
}

function LoginRoute() {
  const { user, authLoading } = useApp();
  if (authLoading) return <LoadingSpinner />;
  if (user) return <Navigate to={roleDashboard[user.role] || '/'} replace />;
  return <LoginPage />;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<PublicLayout />}>
      <Route index element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/centres" element={<CentresPage />} />
      <Route path="/contact" element={<ContactPage />} />
    </Route>
    <Route path="/login" element={<LoginRoute />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute role="farmer"><DashboardLayout role="farmer" /></ProtectedRoute>}>
      <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
      <Route path="/farmer/book-slot" element={<BookSlotPage />} />
      <Route path="/farmer/booking" element={<BookingPage />} />
      <Route path="/farmer/queue" element={<QueuePage />} />
      <Route path="/farmer/procurement" element={<ProcurementPage />} />
      <Route path="/farmer/payment" element={<PaymentPage />} />
      <Route path="/farmer/notifications" element={<NotificationsPage />} />
      <Route path="/farmer/profile" element={<FarmerProfilePage />} />
    </Route>
    <Route element={<ProtectedRoute role="staff"><DashboardLayout role="staff" /></ProtectedRoute>}>
      <Route path="/staff/dashboard" element={<StaffDashboard />} />
      <Route path="/staff/queue" element={<StaffQueuePage />} />
      <Route path="/staff/bookings" element={<StaffBookingsPage />} />
    </Route>
    <Route element={<ProtectedRoute role="admin"><DashboardLayout role="admin" /></ProtectedRoute>}>
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/centres" element={<AdminCentresPage />} />
      <Route path="/admin/schedules" element={<AdminSchedulesPage />} />
      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
      <Route path="/admin/staff" element={<AdminStaffPage />} />
      <Route path="/admin/settings" element={<AdminPlaceholderPage type="settings" />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
