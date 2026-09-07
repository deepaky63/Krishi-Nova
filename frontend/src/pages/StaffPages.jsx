import { AlertTriangle, CheckCircle2, Clock3, Gauge, PackageCheck, UsersRound, UserCheck, Check, XCircle, Slash } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Button, LoadingSpinner, StatCard, StatusBadge } from '../components/UI';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

function ProcurementModal({ isOpen, onClose, type, item, onSubmit }) {
  const [acceptedQty, setAcceptedQty] = useState('');
  const [weighedQty, setWeighedQty] = useState('');
  const [rejectedQty, setRejectedQty] = useState('');
  const [qualityGrade, setQualityGrade] = useState('Grade A');
  const [rejectionReason, setRejectionReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const initialQty = item?.bookedQuantity || item?.bookingId?.bookedQuantity || 0;
  const unit = item?.quantityUnit || item?.bookingId?.quantityUnit || 'kg';
  const farmerName = item?.farmerId?.name || (typeof item?.farmerId === 'string' ? item.farmerId : 'Farmer');
  const commodity = item?.commodityName || item?.commodityId?.name || item?.bookingId?.commodityName || item?.bookingId?.commodityId?.name || 'Crop';

  useEffect(() => {
    if (item) {
      const booked = item.bookedQuantity || item.bookingId?.bookedQuantity || 0;
      setWeighedQty(booked);
      setAcceptedQty(type === 'reject' ? 0 : booked);
      setRejectedQty(type === 'reject' ? booked : 0);
      setQualityGrade(type === 'reject' ? 'Substandard' : 'Grade A');
      setRejectionReason('');
      setRemarks(type === 'accept' ? 'Verified and accepted' : '');
    }
  }, [item, type, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (type === 'reject' && !rejectionReason.trim()) {
      alert('Rejection reason is mandatory.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        type,
        item,
        actualWeighedQuantity: Number(weighedQty) || Number(acceptedQty) + Number(rejectedQty) || Number(initialQty),
        acceptedQuantity: type === 'reject' ? 0 : Number(acceptedQty),
        rejectedQuantity: type === 'reject' ? (Number(weighedQty) || Number(initialQty)) : Number(rejectedQty) || 0,
        qualityGrade,
        rejectionReason: rejectionReason.trim(),
        qualityRemarks: remarks.trim()
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const rejectionPresets = [
    'High moisture content (> 14%)',
    'Excessive foreign matter / weed seeds',
    'Grain discoloration / fungal damage',
    'Pest infestation / kernel damage',
    'Substandard grain quality'
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 540 }}>
        <header>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: type === 'reject' ? '#dc2626' : (type === 'partial' ? '#d97706' : '#0f673c') }}>
              {type === 'accept' && 'Accept Crop Procurement'}
              {type === 'partial' && 'Partially Accept Crop'}
              {type === 'reject' && 'Reject Crop Lot'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Farmer: <strong>{farmerName}</strong> • {commodity} ({initialQty} {unit})
            </p>
          </div>
          <button onClick={onClose} style={{ fontSize: '1.5rem', cursor: 'pointer', border: 'none', background: 'none' }}>&times;</button>
        </header>

        <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, padding: 20 }}>
          {type === 'accept' && (
            <>
              <label>
                Accepted Quantity ({unit})
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={acceptedQty}
                  onChange={(e) => setAcceptedQty(e.target.value)}
                />
              </label>
              <label>
                Quality Grade
                <select value={qualityGrade} onChange={(e) => setQualityGrade(e.target.value)}>
                  <option value="Grade A">Grade A (FAQ - Fair Average Quality)</option>
                  <option value="Grade B">Grade B</option>
                  <option value="Premium">Premium</option>
                </select>
              </label>
              <label>
                Staff Remarks
                <input
                  type="text"
                  value={remarks}
                  placeholder="e.g., Clean grain, moisture within 12%"
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </label>
            </>
          )}

          {type === 'partial' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  Accepted Quantity ({unit})
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={acceptedQty}
                    onChange={(e) => {
                      const acc = Number(e.target.value);
                      setAcceptedQty(e.target.value);
                      if (initialQty > acc) setRejectedQty(initialQty - acc);
                    }}
                  />
                </label>
                <label>
                  Rejected Quantity ({unit})
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Quality Grade
                <select value={qualityGrade} onChange={(e) => setQualityGrade(e.target.value)}>
                  <option value="Grade B">Grade B</option>
                  <option value="Grade A">Grade A</option>
                  <option value="FAQ">FAQ (Fair Average Quality)</option>
                </select>
              </label>
              <label>
                Reason for Partial Rejection
                <input
                  type="text"
                  value={rejectionReason}
                  placeholder="e.g., 5 bags affected by moisture"
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </label>
              <label>
                Staff Remarks
                <input
                  type="text"
                  value={remarks}
                  placeholder="e.g., Partial acceptance approved after sorting"
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </label>
            </>
          )}

          {type === 'reject' && (
            <>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>
                  Rejection Reason <strong style={{ color: '#dc2626' }}>* (Mandatory)</strong>
                </span>
                <input
                  type="text"
                  required
                  placeholder="Specify exact rejection reason..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {rejectionPresets.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setRejectionReason(preset)}
                    style={{
                      fontSize: '0.72rem',
                      background: rejectionReason === preset ? '#fee2e2' : '#f1f5f9',
                      color: rejectionReason === preset ? '#b91c1c' : '#475569',
                      border: rejectionReason === preset ? '1px solid #f87171' : '1px solid #e2e8f0',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <label>
                Additional Remarks
                <input
                  type="text"
                  value={remarks}
                  placeholder="Optional observation notes..."
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </label>
            </>
          )}

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={submitting || (type === 'reject' && !rejectionReason.trim())}
              style={{
                background: type === 'reject' ? '#dc2626' : (type === 'partial' ? '#d97706' : '#059669'),
                color: '#fff'
              }}
            >
              {submitting ? 'Processing...' : (
                type === 'accept' ? 'Accept & Complete' : (type === 'partial' ? 'Confirm Partial Accept' : 'Confirm Rejection')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StaffOperationsTable({ items, onCheckIn, onUpdateStatus, onOpenModal, compact = false }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
        <p>No procurement bookings or queue entries found for this view.</p>
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
                    <div className="row-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                      {!isBookingOnly && (item.status === 'processing' || item.status === 'quality_check') && (
                        <>
                          <button
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                            onClick={() => onOpenModal('accept', item)}
                            title="Accept entire lot and issue direct settlement"
                          >
                            Accept Crop
                          </button>
                          <button
                            style={{ background: '#d97706', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                            onClick={() => onOpenModal('partial', item)}
                            title="Accept part of the lot with deduction"
                          >
                            Partially Accept
                          </button>
                          <button
                            style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                            onClick={() => onOpenModal('reject', item)}
                            title="Reject crop lot due to quality issues"
                          >
                            Reject Crop
                          </button>
                        </>
                      )}
                      {!isBookingOnly && item.status === 'waiting' && (
                        <button
                          style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => onUpdateStatus(item, 'checked_in')}
                        >
                          Check in
                        </button>
                      )}
                      {(item.status === 'served' || item.status === 'completed') && (
                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={14} /> Completed
                        </span>
                      )}
                      {(item.status === 'cancelled' || item.status === 'rejected') && (
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <XCircle size={14} /> Rejected
                        </span>
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
  const [modalState, setModalState] = useState({ isOpen: false, type: null, item: null });

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
  const { activeItems, completedItems, combinedItems } = useMemo(() => {
    // Collect all booking IDs that already have a queue entry
    const queueBookingIds = new Set(
      queueItems.map((q) => (q.bookingId?._id || q.bookingId)?.toString())
    );

    // Bookings that haven't been checked in yet
    const unqueuedBookings = bookings
      .filter((b) => !queueBookingIds.has(b._id?.toString()) && b.status === 'booked')
      .map((b) => ({ ...b, _isBooking: true }));

    // Queue entries
    const queueEntries = queueItems.map((q) => ({ ...q, _isBooking: false }));

    const all = [...queueEntries, ...unqueuedBookings];

    const active = all.filter((item) =>
      ['booked', 'waiting', 'checked_in', 'processing', 'quality_check', 'weighed'].includes(item.status)
    );

    const completed = all.filter((item) =>
      ['served', 'completed', 'cancelled', 'rejected'].includes(item.status)
    );

    return { activeItems: active, completedItems: completed, combinedItems: all };
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
      await loadData();
    } catch (error) {
      notify(error.response?.data?.message || 'Unable to update queue.', 'error');
    }
  };

  const openModal = (type, item) => {
    setModalState({ isOpen: true, type, item });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, type: null, item: null });
  };

  const handleProcurementAction = async (data) => {
    const { type, item, acceptedQuantity, rejectedQuantity, actualWeighedQuantity, qualityGrade, qualityRemarks, rejectionReason } = data;
    const bookingId = item._isBooking ? item._id : (item.bookingId?._id || item.bookingId);

    try {
      if (type === 'reject') {
        await api.rejectProcurement(bookingId, {
          rejectionReason,
          qualityRemarks
        });
        notify('Procurement rejected. Farmer updated and removed from active queue.', 'info');
      } else {
        // Accept or Partially Accept
        await api.completeProcurement(bookingId, {
          acceptedQuantity,
          rejectedQuantity,
          actualWeighedQuantity,
          qualityGrade,
          qualityRemarks,
          rejectionReason
        });
        notify(
          type === 'partial'
            ? 'Procurement partially accepted. Direct settlement initiated.'
            : 'Procurement accepted and completed. Settlement initiated.',
          'success'
        );
      }
      await loadData();
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to complete procurement workflow.', 'error');
      throw error;
    }
  };

  return {
    activeItems,
    completedItems,
    combinedItems,
    queueItems,
    bookings,
    loading,
    refresh: loadData,
    checkIn,
    updateStatus,
    openModal,
    closeModal,
    modalState,
    handleProcurementAction,
    centreId
  };
}

export function StaffDashboard() {
  const { activeItems, completedItems, combinedItems, loading, checkIn, updateStatus, openModal, closeModal, modalState, handleProcurementAction, centreId } = useStaffOperations();

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  const totalEntries = combinedItems.length;
  const waiting = activeItems.filter((item) => item.status === 'waiting' || item.status === 'checked_in' || item.status === 'booked').length;
  const processing = activeItems.filter((item) => item.status === 'processing' || item.status === 'quality_check').length;
  const completed = completedItems.length;

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
        <StatCard icon={CheckCircle2} value={completed} label="Completed &amp; Handled" note="Served / processed" accent="green" />
        <StatCard icon={Gauge} value="—" label="Average waiting" note="Live telemetry" accent="gold" />
        <StatCard icon={Gauge} value="—" label="Centre capacity" note="Configured by admin" accent="blue" />
      </section>

      <section className="operations-card">
        <div className="section-row">
          <div>
            <span className="eyebrow">ACTIVE OPERATIONAL QUEUE</span>
            <h2>Manage active farmers ({activeItems.length})</h2>
          </div>
          <Button to="/staff/queue" variant="secondary">Full operations queue</Button>
        </div>
        <StaffOperationsTable
          items={activeItems}
          onCheckIn={checkIn}
          onUpdateStatus={updateStatus}
          onOpenModal={openModal}
          compact
        />
      </section>

      <ProcurementModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        item={modalState.item}
        onSubmit={handleProcurementAction}
      />
    </div>
  );
}

export function StaffQueuePage() {
  const { activeItems, completedItems, loading, checkIn, updateStatus, openModal, closeModal, modalState, handleProcurementAction } = useStaffOperations();
  const [tab, setTab] = useState('active');

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  return (
    <div className="dashboard-page staff-page">
      <div className="page-intro">
        <span className="eyebrow">LIVE QUEUE MANAGEMENT</span>
        <h2>Check in and serve farmers in order.</h2>
        <p>Incoming booked arrivals can be checked in immediately. Active tokens progress through processing to acceptance, weighing, or rejection.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <button
          onClick={() => setTab('active')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            cursor: 'pointer',
            background: tab === 'active' ? '#0f673c' : '#e2e8f0',
            color: tab === 'active' ? '#fff' : '#475569'
          }}
        >
          Active Queue ({activeItems.length})
        </button>
        <button
          onClick={() => setTab('history')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            cursor: 'pointer',
            background: tab === 'history' ? '#0f673c' : '#e2e8f0',
            color: tab === 'history' ? '#fff' : '#475569'
          }}
        >
          Completed &amp; Handled ({completedItems.length})
        </button>
      </div>

      <section className="operations-card full-table">
        <StaffOperationsTable
          items={tab === 'active' ? activeItems : completedItems}
          onCheckIn={checkIn}
          onUpdateStatus={updateStatus}
          onOpenModal={openModal}
        />
      </section>

      <ProcurementModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        item={modalState.item}
        onSubmit={handleProcurementAction}
      />
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
          onOpenModal={() => {}}
        />
      </section>
    </div>
  );
}

