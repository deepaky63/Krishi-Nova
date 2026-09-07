import { AlertTriangle, CheckCircle2, Clock3, Gauge, PackageCheck, UsersRound, UserCheck } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Button, LoadingSpinner, StatCard, StatusBadge } from '../components/UI';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

function StaffOperationsTable({ items, onCheckIn, onUpdateStatus, compact = false }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
        <p>No procurement bookings or queue entries found for this centre.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="queue-table">
        <thead>
          <tr>
            <th>Token / Ref</th>
            <th>Farmer</th>
            <th>Commodity</th>
            <th>Date &amp; Slot</th>
            <th>Quantity</th>
            <th>Status</th>
            <th>Time</th>
            {!compact && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isBookingOnly = item._isBooking;
            const farmerName = item.farmerId?.name || (typeof item.farmerId === 'string' ? item.farmerId : 'Farmer');
            const farmerPhone = item.farmerId?.phone;
            const commodity = item.commodityName || item.commodityId?.name || item.bookingId?.commodityName || item.bookingId?.commodityId?.name || '—';
            const slotTimes = item.slotId?.startTime ? `${item.slotId.startTime}–${item.slotId.endTime}` : (item.bookingId?.slotId?.startTime ? `${item.bookingId.slotId.startTime}–${item.bookingId.slotId.endTime}` : '—');
            const bookingDate = item.bookingDate ? new Date(item.bookingDate).toLocaleDateString('en-IN') : (item.date ? new Date(item.date).toLocaleDateString('en-IN') : '');
            const quantity = item.bookedQuantity || item.bookingId?.bookedQuantity || '—';
            const unit = item.quantityUnit || item.bookingId?.quantityUnit || 'kg';
            const tokenOrCode = item.queueNumber || item.bookingCode || '—';
            const timeLabel = item.checkedInAt ? `Checked in: ${new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : (item.createdAt ? `Booked: ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—');

            return (
              <tr key={item._id}>
                <td>
                  <b style={{ color: item.queueNumber ? '#047857' : '#1e293b' }}>{tokenOrCode}</b>
                  {item.bookingCode && item.queueNumber && <div style={{ fontSize: 11, color: '#64748b' }}>{item.bookingCode}</div>}
                </td>
                <td>
                  <div><b>{farmerName}</b></div>
                  {farmerPhone && <div style={{ fontSize: 11, color: '#64748b' }}>{farmerPhone}</div>}
                </td>
                <td><b>{commodity}</b></td>
                <td>
                  <div>{slotTimes}</div>
                  {bookingDate && <div style={{ fontSize: 11, color: '#64748b' }}>{bookingDate}</div>}
                </td>
                <td>{quantity} {unit}</td>
                <td><StatusBadge status={item.status} /></td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{timeLabel}</td>
                {!compact && (
                  <td>
                    <div className="row-actions">
                      {isBookingOnly && item.status === 'booked' && (
                        <button
                          style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => onCheckIn(item)}
                        >
                          <UserCheck size={14} /> Check in
                        </button>
                      )}
                      {!isBookingOnly && item.status === 'checked_in' && (
                        <button
                          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => onUpdateStatus(item, 'processing')}
                        >
                          Start processing
                        </button>
                      )}
                      {!isBookingOnly && item.status === 'processing' && (
                        <button
                          className="served"
                          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => onUpdateStatus(item, 'served')}
                        >
                          Mark served
                        </button>
                      )}
                      {!isBookingOnly && item.status === 'waiting' && (
                        <button
                          style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => onUpdateStatus(item, 'checked_in')}
                        >
                          Check in
                        </button>
                      )}
                      {item.status === 'served' && (
                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>Completed</span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function useStaffOperations() {
  const { user, notify } = useApp();
  const [queueItems, setQueueItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Normalize centreId whether assignedCentreIds[0] is an ObjectId string or an object
  const centreId = user?.assignedCentreIds?.[0]?._id || user?.assignedCentreIds?.[0];

  const loadData = async () => {
    if (!centreId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [queueRes, bookingsRes] = await Promise.all([
        api.getQueue({ centreId: String(centreId) }).catch(() => []),
        api.getStaffBookings({ centreId: String(centreId) }).catch(() => [])
      ]);
      setQueueItems(Array.isArray(queueRes) ? queueRes : []);
      setBookings(Array.isArray(bookingsRes) ? bookingsRes : []);
    } catch (error) {
      notify(error.response?.data?.message || 'Unable to load centre operations.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centreId]);

  // Merge active bookings and queue items seamlessly
  const combinedItems = useMemo(() => {
    // Collect all booking IDs that already have a queue entry
    const queueBookingIds = new Set(
      queueItems.map((q) => (q.bookingId?._id || q.bookingId)?.toString())
    );

    // Bookings that haven't been checked in yet
    const unqueuedBookings = bookings
      .filter((b) => !queueBookingIds.has(b._id?.toString()) && b.status === 'booked')
      .map((b) => ({ ...b, _isBooking: true }));

    // Queue entries (checked_in, waiting, processing, served)
    const activeQueue = queueItems.map((q) => ({ ...q, _isBooking: false }));

    return [...activeQueue, ...unqueuedBookings];
  }, [queueItems, bookings]);

  const checkIn = async (item) => {
    try {
      const bookingId = item._id;
      await api.checkIn(bookingId);
      notify('Farmer checked in successfully. Queue token issued.', 'success');
      await loadData();
    } catch (error) {
      notify(error.response?.data?.message || 'Unable to check in farmer.', 'error');
    }
  };

  const updateStatus = async (item, status) => {
    try {
      const result = await api.updateQueueStatus(item._id, status);
      setQueueItems((current) => current.map((entry) => (entry._id === item._id ? result : entry)));
      notify(`Queue entry updated to ${status}.`, 'success');
    } catch (error) {
      notify(error.response?.data?.message || 'Unable to update queue.', 'error');
    }
  };

  return {
    combinedItems,
    queueItems,
    bookings,
    loading,
    refresh: loadData,
    checkIn,
    updateStatus,
    centreId
  };
}

export function StaffDashboard() {
  const { combinedItems, queueItems, bookings, loading, checkIn, updateStatus, centreId } = useStaffOperations();

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  const totalEntries = combinedItems.length;
  const waiting = combinedItems.filter((item) => item.status === 'waiting' || item.status === 'checked_in' || item.status === 'booked').length;
  const processing = combinedItems.filter((item) => item.status === 'processing').length;
  const completed = combinedItems.filter((item) => item.status === 'served' || item.status === 'completed').length;

  return (
    <div className="dashboard-page staff-page">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">CENTRE OPERATIONS</span>
          <h2>Today’s centre operations</h2>
          <p>
            {centreId ? 'Real-time overview of incoming arrivals, active queue, and served farmers.' : 'No centre assigned to your account. Please contact an administrator.'}
          </p>
        </div>
        <span className="date-chip">Live operational data</span>
      </div>

      <section className="staff-stats">
        <StatCard icon={UsersRound} value={totalEntries} label="Total Bookings &amp; Queue" note="Assigned centre" accent="green" />
        <StatCard icon={Clock3} value={waiting} label="Waiting &amp; Booked" note="Awaiting service" accent="gold" />
        <StatCard icon={PackageCheck} value={processing} label="Processing" note="Currently at counter" accent="blue" />
        <StatCard icon={CheckCircle2} value={completed} label="Completed" note="Served entries" accent="green" />
        <StatCard icon={Gauge} value="—" label="Average waiting" note="Live telemetry" accent="gold" />
        <StatCard icon={Gauge} value="—" label="Centre capacity" note="Configured by admin" accent="blue" />
      </section>

      <section className="operations-card">
        <div className="section-row">
          <div>
            <span className="eyebrow">LIVE QUEUE &amp; ARRIVALS</span>
            <h2>Manage active farmers</h2>
          </div>
          <Button to="/staff/queue" variant="secondary">Full operations queue</Button>
        </div>
        <StaffOperationsTable
          items={combinedItems}
          onCheckIn={checkIn}
          onUpdateStatus={updateStatus}
          compact
        />
      </section>
    </div>
  );
}

export function StaffQueuePage() {
  const { combinedItems, loading, checkIn, updateStatus } = useStaffOperations();

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  return (
    <div className="dashboard-page staff-page">
      <div className="page-intro">
        <span className="eyebrow">LIVE QUEUE MANAGEMENT</span>
        <h2>Check in and serve farmers in order.</h2>
        <p>Incoming booked arrivals can be checked in immediately. Active tokens progress through processing to completion.</p>
      </div>
      <section className="operations-card full-table">
        <StaffOperationsTable
          items={combinedItems}
          onCheckIn={checkIn}
          onUpdateStatus={updateStatus}
        />
      </section>
    </div>
  );
}

export function StaffBookingsPage() {
  const { bookings, loading, checkIn } = useStaffOperations();

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  const activeBookings = bookings.map((b) => ({ ...b, _isBooking: true }));

  return (
    <div className="dashboard-page staff-page">
      <div className="page-intro">
        <span className="eyebrow">CENTRE BOOKINGS</span>
        <h2>Expected arrivals and operational allocation</h2>
        <p>{bookings.length} total bookings recorded for your assigned centre.</p>
      </div>
      <section className="operations-card">
        <div className="section-row">
          <h2>Assigned-centre bookings ({bookings.length})</h2>
          <StatusBadge status="Live" />
        </div>
        <StaffOperationsTable
          items={activeBookings}
          onCheckIn={checkIn}
          onUpdateStatus={() => {}}
        />
      </section>
    </div>
  );
}
