import { AlertTriangle, Bell, CalendarCheck2, Check, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, FileCheck2, MapPin, Radio, ReceiptText, Sprout, UsersRound, Wheat, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, LoadingSpinner, SectionTitle, SlotCard, StatusBadge, Timeline } from '../components/UI';
import { api } from '../services/api';
import { getAccessToken } from '../services/api';
import { connectQueueSocket } from '../services/socket';
import { useApp } from '../context/AppContext';

const bookingStatuses = ['booked', 'checked_in', 'quality_check', 'weighed', 'accepted', 'partially_accepted', 'rejected', 'completed', 'cancelled', 'no_show'];
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : 'Not available';
const errorText = (error) => error.response?.data?.message || 'Unable to load information.';

function useLatestBooking() {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getMyBookings().then((items) => setBooking(items[0] || null)).catch(() => setBooking(null)).finally(() => setLoading(false)); }, []);
  return { booking, loading };
}

export function FarmerDashboard() {
  const { user } = useApp();
  const { booking, loading } = useLatestBooking();
  const farmerActions = [[CalendarCheck2, 'Book new slot', 'Choose an available time', '/farmer/book-slot'], [ReceiptText, 'My booking', booking ? booking.bookingCode : 'No active booking', '/farmer/booking'], [UsersRound, 'Live queue', 'View your check-in position', '/farmer/queue'], [FileCheck2, 'Procurement status', 'Track verification and weighing', '/farmer/procurement'], [CircleDollarSign, 'Payment status', 'View settlement details', '/farmer/payment'], [Bell, 'Notifications', 'Review important updates', '/farmer/notifications']];
  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;
  return <div className="dashboard-page farmer-dashboard"><div className="welcome-row"><div><span className="eyebrow">WELCOME, {user?.name?.toUpperCase() || 'FARMER'}</span><h2>Your procurement day, made simpler.</h2><p>{booking ? 'Here is the latest on your confirmed booking.' : 'You do not have an active booking yet.'}</p></div><Button to="/farmer/book-slot">Book new slot</Button></div>{booking ? <section className="today-status"><div className="today-status-top"><div><StatusBadge status={booking.status} /><h2>Current procurement status</h2><p>{booking.centreId?.name || 'Selected procurement centre'}</p></div><span className="token-chip">BOOKING <b>{booking.bookingCode}</b></span></div><div className="today-details"><div><MapPin /><span><small>Centre</small><b>{booking.centreId?.name || booking.centreId}</b></span></div><div><Clock3 /><span><small>Date</small><b>{formatDate(booking.bookingDate)}</b></span></div><div><Wheat /><span><small>Quantity</small><b>{booking.bookedQuantity} {booking.quantityUnit} {booking.commodityName ? `(${booking.commodityName})` : booking.commodityId?.name ? `(${booking.commodityId.name})` : ''}</b></span></div><Button to="/farmer/queue" variant="secondary">View live queue</Button></div></section> : <div className="empty-state"><Sprout size={30} /><h3>No active booking</h3><p>Choose a centre, commodity and available slot to begin.</p></div>}<section><SectionTitle eyebrow="QUICK ACTIONS" title="Everything important, in one place" /><div className="farmer-action-grid">{farmerActions.map(([Icon, title, text, to]) => <Link to={to} className="farmer-action" key={title}><span><Icon size={22} /></span><div><b>{title}</b><p>{text}</p></div><ChevronRight size={19} /></Link>)}</div></section></div>;
}

const activeStatuses = ['booked', 'checked_in', 'quality_check', 'weighed', 'accepted', 'partially_accepted'];

export function BookSlotPage() {
  const navigate = useNavigate(); const { notify, setBooking } = useApp();
  const [commodities, setCommodities] = useState([]); const [centres, setCentres] = useState([]); const [slots, setSlots] = useState([]);
  const [commodity, setCommodity] = useState(null); const [centre, setCentre] = useState(null); const [slot, setSlot] = useState(null); const [quantity, setQuantity] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [centreSearch, setCentreSearch] = useState('');
  const [existingActiveBooking, setExistingActiveBooking] = useState(null);
  const [queueInfo, setQueueInfo] = useState(null);
  
  useEffect(() => {
    Promise.all([
      api.getCommodities(),
      api.getCentres(),
      api.getAvailableSlots(),
      api.getMyBookings().catch(() => [])
    ]).then(([commodityData, centreData, slotData, myBookingsData]) => {
      const active = (myBookingsData || []).find((b) => activeStatuses.includes(b.status));
      if (active) {
        setExistingActiveBooking(active);
        api.getBookingQueue(active._id).then((qData) => {
          if (Array.isArray(qData) && qData.length > 0) {
            setQueueInfo(qData[0]);
          }
        }).catch(() => {});
      }

      const rawCommodities = commodityData || [];
      const nextCentres = centreData.items || centreData || [];
      const nextSlots = slotData || [];

      // Aggregate commodities from registered commodities + slot supportedCommodities
      const commodityMap = new Map();
      rawCommodities.forEach((c) => {
        if (c && c.name) {
          commodityMap.set(c.name.trim().toLowerCase(), {
            _id: c._id,
            name: c.name.trim(),
            quantityUnit: c.quantityUnit || 'kg',
            isRegistered: true,
          });
        }
      });

      nextSlots.forEach((s) => {
        (s.supportedCommodities || []).forEach((name) => {
          if (name && typeof name === 'string') {
            const key = name.trim().toLowerCase();
            if (!commodityMap.has(key)) {
              commodityMap.set(key, {
                _id: `custom_${key}`,
                name: name.trim(),
                quantityUnit: s.quantityUnit || 'kg',
                isRegistered: false,
              });
            }
          }
        });
      });

      const nextCommodities = Array.from(commodityMap.values());
      setCommodities(nextCommodities);
      setCentres(nextCentres);
      setCommodity(nextCommodities[0] || null);
      setCentre(nextCentres[0] || null);
      setSlots(nextSlots);
      setSlot(nextSlots[0] || null);
    }).catch((error) => notify(errorText(error), 'error')).finally(() => setLoading(false));
  }, []);

  const visibleCentres = centres.filter((item) => {
    if (!centreSearch.trim()) return true;
    const q = centreSearch.trim().toLowerCase();
    const nameMatch = item.name?.toLowerCase().includes(q);
    const addressMatch = item.address?.toLowerCase().includes(q);
    const districtMatch = item.district?.toLowerCase().includes(q);
    const codeMatch = item.centreCode?.toLowerCase().includes(q);
    return nameMatch || addressMatch || districtMatch || codeMatch;
  });

  const availableSlots = slots.filter((item) => {
    const matchesCentre = !centre || (item.centreId?._id || item.centreId) === centre._id;
    if (!matchesCentre) return false;

    if (commodity) {
      const targetName = commodity.name.toLowerCase();
      const hasSupported = item.supportedCommodities?.some(
        (name) => name.toLowerCase() === targetName
      );
      const hasId = commodity.isRegistered && item.commodityIds?.some(
        (c) => (c._id || c) === commodity._id || (c.name && c.name.toLowerCase() === targetName)
      );
      if (!hasSupported && !hasId) return false;
    }

    const isPositiveCapacity = item.remainingCapacity > 0;
    const isSufficientQuantity = item.remainingQuantity == null || item.remainingQuantity >= Number(quantity || 0);

    return item.active && isPositiveCapacity && isSufficientQuantity;
  });

  const book = async () => {
    if (existingActiveBooking) {
      return notify('You already have an active procurement booking. Please complete or cancel your existing booking before booking another slot.', 'error');
    }
    if (!commodity || !centre || !slot || !quantity) return notify('Select a commodity, centre, slot and quantity.', 'error');
    setSaving(true);
    try {
      const bookingPayload = {
        centreId: centre._id,
        slotId: slot._id,
        bookedQuantity: Number(quantity),
        quantityUnit: commodity.quantityUnit || 'kg',
        commodityName: commodity.name,
      };
      if (commodity.isRegistered && commodity._id && !String(commodity._id).startsWith('custom_')) {
        bookingPayload.commodityId = commodity._id;
      }
      const response = await api.createBooking(bookingPayload);
      setBooking({ ...response, centreId: centre, commodityId: commodity, slotId: slot, commodityName: commodity.name });
      notify('Your booking has been created.');
      navigate('/farmer/booking');
    } catch (error) {
      const msg = error.response?.data?.message || errorText(error);
      notify(msg, 'error');
      if (error.response?.data?.error?.code === 'ACTIVE_BOOKING_EXISTS' || msg.toLowerCase().includes('already have an active')) {
        api.getMyBookings().then((myBookings) => {
          const active = (myBookings || []).find((b) => activeStatuses.includes(b.status));
          if (active) setExistingActiveBooking(active);
        }).catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  if (existingActiveBooking) {
    const b = existingActiveBooking;
    const centreName = b.centreId?.name || b.centreId || 'Procurement Centre';
    const commodityTitle = b.commodityName || b.commodityId?.name || 'Procurement Commodity';
    const slotTime = b.slotId?.startTime ? `${b.slotId.startTime} – ${b.slotId.endTime}` : (b.slotTime || 'Assigned slot');
    const isCheckedIn = ['checked_in', 'processing', 'weighed', 'quality_check'].includes(b.status);

    return (
      <div className="dashboard-page booking-page">
        <div className="page-intro">
          <span className="eyebrow" style={{ color: '#0f673c', fontWeight: 800 }}>ACTIVE PROCUREMENT DETECTED</span>
          <h2 style={{ color: '#07351f', fontWeight: 800 }}>You already have an active booking</h2>
          <p style={{ color: '#334e3e', fontSize: '0.94rem' }}>
            To prevent congestion and ensure fair access, each farmer may hold only one active procurement booking at a time.
            Please complete or cancel your existing booking before booking another slot.
          </p>
        </div>

        <section className="active-booking-card">
          <div className="active-booking-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="active-booking-status-badge">
                  <i className="active-booking-status-dot" />
                  {String(b.status).replace('_', ' ')}
                </span>
                {queueInfo?.queueNumber && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      background: '#fef08a',
                      color: '#713f12',
                      border: '1px solid #facc15',
                      marginBottom: 12
                    }}
                  >
                    TOKEN: <b>{queueInfo.queueNumber}</b>
                  </span>
                )}
              </div>
              <h2 className="active-booking-title">
                {isCheckedIn ? 'Checked in to operational queue' : 'Your booking is confirmed'}
              </h2>
              <p className="active-booking-centre-sub">
                {centreName}
              </p>
              {queueInfo?.farmersAhead != null && (
                <div className="active-booking-queue-pill">
                  <UsersRound size={16} />
                  <span>
                    {queueInfo.farmersAhead === 0 ? (
                      <><b>You're next</b> — 0 farmers ahead of you</>
                    ) : (
                      <>Queue Position <b>#{queueInfo.queuePosition}</b> · <b>{queueInfo.farmersAhead}</b> farmer{queueInfo.farmersAhead === 1 ? '' : 's'} ahead of you</>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="active-booking-id-box">
              <span className="active-booking-id-label">
                BOOKING ID
              </span>
              <span className="active-booking-id-value">
                {b.bookingCode}
              </span>
            </div>
          </div>

          <div className="active-booking-grid">
            <div className="active-booking-item">
              <span className="active-booking-icon">
                <MapPin size={24} />
              </span>
              <div>
                <small className="active-booking-label">
                  Procurement Centre
                </small>
                <b className="active-booking-val">
                  {centreName}
                </b>
              </div>
            </div>

            <div className="active-booking-item">
              <span className="active-booking-icon">
                <Clock3 size={24} />
              </span>
              <div>
                <small className="active-booking-label">
                  Date &amp; Slot
                </small>
                <b className="active-booking-val">
                  {formatDate(b.bookingDate)} ({slotTime})
                </b>
              </div>
            </div>

            <div className="active-booking-item">
              <span className="active-booking-icon">
                <Wheat size={24} />
              </span>
              <div>
                <small className="active-booking-label">
                  Commodity &amp; Quantity
                </small>
                <b className="active-booking-val">
                  {commodityTitle} · {b.bookedQuantity} {b.quantityUnit || 'kg'}
                </b>
              </div>
            </div>

            <div className="active-booking-actions">
              <Link
                to="/farmer/booking"
                className="active-booking-btn-primary"
              >
                View booking details
                <ChevronRight size={16} />
              </Link>
              <Link
                to="/farmer/queue"
                className="active-booking-btn-secondary"
              >
                Live queue
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return <div className="dashboard-page booking-page">
    <div className="page-intro">
      <span className="eyebrow">SLOT BOOKING</span>
      <h2>Plan your visit around an available slot.</h2>
      <p>Select data configured by an administrator. Availability is validated by the backend.</p>
    </div>
    
    <section className="booking-section">
      <div className="booking-section-title">
        <span>01</span>
        <div>
          <h3>Select commodity</h3>
          <p>Choose what you are bringing to the centre.</p>
        </div>
      </div>
      <div className="commodity-options">
        {commodities.map((item) => (
          <button
            key={item._id}
            className={commodity?._id === item._id ? 'selected' : ''}
            onClick={() => setCommodity(item)}
          >
            <Wheat size={24} />
            <b>{item.name}</b>
            <small>{item.quantityUnit || 'kg'}</small>
            <i>{commodity?._id === item._id && <Check size={15} />}</i>
          </button>
        ))}
      </div>
    </section>

    <section className="booking-section">
      <div className="booking-section-title">
        <span>02</span>
        <div>
          <h3>Select procurement centre</h3>
          <p>Choose a centre that supports your commodity. Search by centre name, address, or code.</p>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={centreSearch}
          onChange={(e) => setCentreSearch(e.target.value)}
          placeholder="Search centre by name, address, or code (e.g. C-101)…"
          className="slot-input"
          style={{ maxWidth: 420 }}
        />
      </div>

      <div className="booking-centres">
        {visibleCentres.map((item) => (
          <button
            key={item._id}
            className={centre?._id === item._id ? 'selected' : ''}
            onClick={() => setCentre(item)}
          >
            <MapPin />
            <span>
              <b>{item.name}</b>
              <small>{item.address}, {item.district} {item.centreCode ? `· [${item.centreCode}]` : ''}</small>
            </span>
            <StatusBadge status={item.status} />
            <i>{centre?._id === item._id && <Check size={15} />}</i>
          </button>
        ))}
        {visibleCentres.length === 0 && (
          <p style={{ color: '#64748b', fontSize: 13, padding: '10px 0' }}>
            No centres found matching "{centreSearch}".
          </p>
        )}
      </div>
    </section>

    <section className="booking-section">
      <div className="booking-section-title">
        <span>03</span>
        <div>
          <h3>Choose your slot</h3>
          <p>Slots are configured by an administrator.</p>
        </div>
      </div>
      <div className="slot-grid">
        {availableSlots.map((item) => (
          <SlotCard
            key={item._id}
            slot={{
              ...item,
              id: item._id,
              time: `${item.startTime} – ${item.endTime}`,
              queue: item.maxFarmers,
              wait: 'Calculated at check-in',
              capacity: `${item.maxFarmers} farmers`,
            }}
            selected={slot?._id === item._id}
            onSelect={setSlot}
          />
        ))}
        {availableSlots.length === 0 && (
          <p style={{ color: '#64748b', fontSize: 13, padding: '10px 0' }}>
            No active slots available for the selected commodity and centre.
          </p>
        )}
      </div>
    </section>

    <section className="booking-section">
      <label>
        Expected quantity ({commodity?.quantityUnit || 'kg'})
        <input
          type="number"
          min="0.001"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </label>
      <Button onClick={book} disabled={saving}>{saving ? 'Booking…' : 'Confirm booking'}</Button>
    </section>
  </div>;
}

export function BookingPage() { const { booking } = useApp(); const [items, setItems] = useState(booking ? [booking] : []); useEffect(() => { if (!booking) api.getMyBookings().then(setItems).catch(() => { }); }, [booking]); const info = items[0]; if (!info) return <div className="dashboard-page"><div className="empty-state"><h3>No booking found</h3><Button to="/farmer/book-slot">Book a slot</Button></div></div>; return <div className="dashboard-page confirmation-page"><div className="confirmation-card"><span className="confirmation-icon"><Check size={40} /></span><span className="eyebrow">BOOKING DETAILS</span><h2>{info.bookingCode}</h2><p>Your booking is stored in Krishi Nova.</p><div className="booking-summary"><div><small>Status</small><b>{info.status}</b></div><div><small>Commodity</small><b>{info.commodityName || info.commodityId?.name || 'Standard'}</b></div><div><small>Centre</small><b>{info.centreId?.name || info.centreId}</b></div><div><small>Date</small><b>{formatDate(info.bookingDate)}</b></div><div><small>Quantity</small><b>{info.bookedQuantity} {info.quantityUnit}</b></div></div><div className="confirmation-actions"><Button to="/farmer/queue">View live queue</Button><Button to="/farmer/dashboard" variant="secondary">Back to dashboard</Button></div></div></div>; }

export function QueuePage() {
  const { booking } = useLatestBooking();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueueData = () => {
    if (!booking) return Promise.resolve();
    return api.getBookingQueue(booking._id)
      .then((result) => setItems(Array.isArray(result) ? result : []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    if (!booking) {
      setLoading(false);
      return;
    }
    let socket;
    fetchQueueData().finally(() => setLoading(false));

    if (getAccessToken()) {
      const centreId = booking.centreId?._id || booking.centreId;
      const slotId = booking.slotId?._id || booking.slotId;
      socket = connectQueueSocket(getAccessToken(), {
        updated: () => {
          // Refresh queue data so queuePosition and farmersAhead recalculate live
          fetchQueueData();
        }
      });
      socket.emit('queue:join', {
        bookingId: booking._id,
        centreId: String(centreId),
        slotId: String(slotId),
        date: booking.bookingDate
      });
    }

    return () => socket?.disconnect();
  }, [booking]);

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  if (!booking) {
    return (
      <div className="dashboard-page queue-page">
        <div className="empty-state">
          <UsersRound size={32} />
          <h3>No active booking</h3>
          <p>Book a slot to view your live queue position and token status.</p>
          <Button to="/farmer/book-slot" style={{ marginTop: 12 }}>Book new slot</Button>
        </div>
      </div>
    );
  }

  const isCheckedIn = items.length > 0;
  const currentToken = items[0];
  const isRejected = booking.status === 'rejected' || currentToken?.procurement?.status === 'rejected';
  const isCompleted = booking.status === 'completed' || currentToken?.status === 'served' || currentToken?.procurement?.status === 'completed';
  const activeStatus = isRejected ? 'rejected' : (isCompleted ? 'completed' : (currentToken ? currentToken.status : booking.status));

  // Rejection reason from procurement audit record or booking
  const rejectionReason = currentToken?.procurement?.rejectionReason || booking.cancellationReason || 'Quality parameters not satisfied (e.g. high moisture content)';

  // Queue position and farmers ahead calculation from operational queue entry
  const queuePos = (isRejected || isCompleted) ? null : currentToken?.queuePosition;
  const farmersAhead = (isRejected || isCompleted) ? 0 : (currentToken?.farmersAhead ?? (isCheckedIn ? 0 : null));

  // Determine formal message
  let formalMessage = '';
  if (isRejected) {
    formalMessage = `Procurement Rejected. Rejection reason: ${rejectionReason}`;
  } else if (isCompleted) {
    formalMessage = 'Procurement Completed Successfully. Your crop has been inspected, weighed, and accepted.';
  } else if (booking.status === 'cancelled' || activeStatus === 'cancelled') {
    formalMessage = 'This booking has been cancelled.';
  } else if (booking.status === 'no_show' || activeStatus === 'no_show') {
    formalMessage = 'You were marked as no-show for this booking. Please contact the procurement centre if you need assistance.';
  } else if (activeStatus === 'processing' || activeStatus === 'quality_check') {
    formalMessage = 'Your procurement is currently being processed at the counter. Please follow instructions from centre staff.';
  } else if (activeStatus === 'checked_in') {
    if (farmersAhead === 0) {
      formalMessage = 'You have checked in successfully. You are next in line. Please remain available.';
    } else {
      formalMessage = `You have checked in successfully. There are ${farmersAhead} farmers ahead of you. Please remain available.`;
    }
  } else if (activeStatus === 'waiting') {
    if (farmersAhead === 0) {
      formalMessage = 'You are in the queue. You are next in line. Please wait for your turn.';
    } else {
      formalMessage = `You are in the queue. There are ${farmersAhead} farmers ahead of you. Please wait for your turn.`;
    }
  } else {
    formalMessage = 'Your booking is confirmed. Please arrive at the procurement centre at your scheduled time.';
  }

  return (
    <div className="dashboard-page queue-page">
      <div className="live-label">
        <Radio size={16} /> Live queue <span>Connected to operational updates</span>
      </div>

      <section className="today-status" style={{ marginBottom: 20 }}>
        <div className="today-status-top">
          <div>
            <StatusBadge status={activeStatus} />
            <h2>Live Queue &amp; Operational Status</h2>
            <p>{booking.centreId?.name || 'Selected Procurement Centre'}</p>
          </div>
          <span className="token-chip">BOOKING <b>{booking.bookingCode}</b></span>
        </div>
        <div className="today-details">
          <div>
            <Clock3 />
            <span>
              <small>Scheduled Slot</small>
              <b>{booking.slotId?.startTime ? `${booking.slotId.startTime} – ${booking.slotId.endTime}` : formatDate(booking.bookingDate)}</b>
            </span>
          </div>
          <div>
            <Wheat />
            <span>
              <small>Commodity</small>
              <b>{booking.commodityName || booking.commodityId?.name || 'Standard'} ({booking.bookedQuantity} {booking.quantityUnit})</b>
            </span>
          </div>
          <div>
            <MapPin />
            <span>
              <small>Centre Address</small>
              <b>{booking.centreId?.address || 'Procurement gate'}</b>
            </span>
          </div>
        </div>
      </section>

      {/* Prominent Outcome Notice for Rejected / Completed */}
      {isRejected && (
        <section
          style={{
            background: '#fef2f2',
            border: '2px solid #f87171',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            boxShadow: '0 4px 16px rgba(220, 38, 38, 0.08)'
          }}
        >
          <div style={{ color: '#dc2626', marginTop: 2, flexShrink: 0 }}>
            <XCircle size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.2rem', fontWeight: 800 }}>
                Procurement Rejected
              </h3>
              <span style={{ fontSize: '0.8rem', background: '#fee2e2', color: '#b91c1c', fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                Inspection Failed
              </span>
            </div>
            <p style={{ margin: '8px 0 4px', color: '#b91c1c', fontSize: '1rem', fontWeight: 700 }}>
              Rejection reason: <span style={{ color: '#7f1d1d', fontWeight: 800 }}>{rejectionReason}</span>
            </p>
            {currentToken?.procurement?.qualityRemarks && (
              <p style={{ margin: '4px 0 8px', color: '#7f1d1d', fontSize: '0.85rem' }}>
                <strong>Staff remarks:</strong> {currentToken.procurement.qualityRemarks}
              </p>
            )}
            <div style={{ marginTop: 8, display: 'flex', gap: 20, fontSize: '0.82rem', color: '#64748b' }}>
              <span>Farmers ahead: <strong style={{ color: '#1e293b' }}>0</strong></span>
              <span>Active queue status: <strong style={{ color: '#dc2626' }}>Removed from active queue</strong></span>
              <span>Settlement: <strong style={{ color: '#64748b' }}>Ineligible</strong></span>
            </div>
          </div>
        </section>
      )}

      {isCompleted && (
        <section
          style={{
            background: '#f0fdf4',
            border: '2px solid #4ade80',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)'
          }}
        >
          <div style={{ color: '#16a34a', marginTop: 2, flexShrink: 0 }}>
            <CheckCircle2 size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, color: '#14532d', fontSize: '1.2rem', fontWeight: 800 }}>
                Procurement Completed Successfully
              </h3>
              <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                Weighed &amp; Accepted
              </span>
            </div>
            <p style={{ margin: '8px 0 4px', color: '#166534', fontSize: '0.95rem' }}>
              Your crop lot has been verified, weighed, and procured by centre staff.
            </p>
            <div style={{ marginTop: 10, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.82rem', color: '#15803d' }}>
              <span>Accepted: <strong>{currentToken?.procurement?.acceptedQuantity ?? booking.bookedQuantity} {booking.quantityUnit || 'kg'}</strong></span>
              {currentToken?.procurement?.rejectedQuantity > 0 && (
                <span>Rejected / Deducted: <strong>{currentToken.procurement.rejectedQuantity} {booking.quantityUnit || 'kg'}</strong></span>
              )}
              <span>Grade: <strong>{currentToken?.procurement?.qualityGrade || 'Grade A'}</strong></span>
              <span>Farmers ahead: <strong>0</strong></span>
            </div>
            <div style={{ marginTop: 12 }}>
              <Link to="/farmer/payment" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f673c', textDecoration: 'underline' }}>
                View settlement &amp; payment disbursement status &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Prominent Real-Time Queue Position Display */}
      <section
        className="queue-position-card"
        style={{
          background: '#ffffff',
          border: '1px solid #d9e7da',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 23,
          boxShadow: '0 8px 24px rgba(13, 57, 34, 0.06)',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 28,
          alignItems: 'center'
        }}
      >
        <div
          style={{
            minWidth: 140,
            textAlign: 'center',
            borderRight: '1px solid #e2e8f0',
            paddingRight: 24
          }}
        >
          <span
            className="eyebrow"
            style={{ marginBottom: 4, letterSpacing: '0.1em', fontSize: '0.7rem' }}
          >
            {isRejected ? 'FINAL OUTCOME' : isCompleted ? 'PROCUREMENT OUTCOME' : (activeStatus === 'processing' || activeStatus === 'quality_check' ? 'IN SERVICE' : isCheckedIn ? 'QUEUE POSITION' : 'BOOKING STATUS')}
          </span>
          <div
            style={{
              fontSize: isRejected || isCompleted ? '2.1rem' : '2.8rem',
              fontWeight: 800,
              lineHeight: 1.05,
              color: isRejected ? '#dc2626' : (isCompleted ? '#059669' : (activeStatus === 'processing' || activeStatus === 'quality_check' ? '#2563eb' : (isCheckedIn ? '#0f673c' : '#1e293b'))),
              letterSpacing: '-0.04em'
            }}
          >
            {isRejected
              ? 'REJECTED'
              : isCompleted
                ? 'COMPLETED'
                : (activeStatus === 'processing' || activeStatus === 'quality_check'
                  ? 'NOW'
                  : (isCheckedIn && queuePos != null ? `#${queuePos}` : (isCheckedIn && currentToken?.queueNumber ? currentToken.queueNumber : 'CONFIRMED')))}
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: isRejected ? '#dc2626' : (isCompleted ? '#059669' : (activeStatus === 'processing' || activeStatus === 'quality_check' ? '#2563eb' : (farmersAhead === 0 ? '#059669' : '#d97706'))),
              marginTop: 6
            }}
          >
            {isRejected
              ? 'Lot rejected'
              : isCompleted
                ? 'Served & processed'
                : (activeStatus === 'processing' || activeStatus === 'quality_check'
                  ? 'Currently processing'
                  : isCheckedIn && farmersAhead != null
                    ? (farmersAhead === 0 ? "You're next in line" : `${farmersAhead} farmers ahead of you`)
                    : (isCheckedIn ? 'In queue' : 'Awaiting check-in'))}
          </div>
        </div>

        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: isRejected ? '#dc2626' : '#0f673c',
              marginBottom: 6
            }}
          >
            <UsersRound size={15} />
            <span>Operational Status &amp; Guidance</span>
          </div>
          <p
            style={{
              fontSize: '1.02rem',
              fontWeight: 600,
              color: '#1e293b',
              lineHeight: 1.45,
              margin: 0
            }}
          >
            "{formalMessage}"
          </p>
          <div
            style={{
              display: 'flex',
              gap: 18,
              marginTop: 12,
              fontSize: '0.75rem',
              color: '#64748b'
            }}
          >
            <span>Token: <strong style={{ color: isRejected ? '#dc2626' : '#0f673c' }}>{currentToken?.queueNumber || (isCheckedIn ? 'Assigned' : 'Pending check-in')}</strong></span>
            <span>Est. Wait: <strong style={{ color: '#1e293b' }}>{isRejected || isCompleted ? '0 min' : (currentToken?.estimatedWaitMinutes != null ? `${currentToken.estimatedWaitMinutes} min` : 'Calculated at entry')}</strong></span>
            <span>Total Active in Queue: <strong style={{ color: '#1e293b' }}>{currentToken?.totalActiveInQueue || (isCheckedIn && !isRejected && !isCompleted ? 1 : 0)}</strong></span>
          </div>
        </div>
      </section>

      <div className="queue-overview">
        <div className="queue-stat">
          <small>{isCheckedIn ? 'Queue Token' : 'Current Status'}</small>
          <strong>{isCheckedIn ? currentToken?.queueNumber : 'CONFIRMED'}</strong>
          <span>{isCheckedIn ? 'Assigned at check-in' : 'Awaiting arrival at centre'}</span>
        </div>
        <div className="queue-stat">
          <small>Farmers Ahead</small>
          <strong>
            {farmersAhead != null ? farmersAhead : (isCheckedIn ? 0 : '—')}
          </strong>
          <span>{isRejected || isCompleted ? 'Completed' : (isCheckedIn ? (farmersAhead === 0 ? "You're next" : 'Ahead in queue') : 'Prior to check-in')}</span>
        </div>
        <div className="queue-stat highlight">
          <small>{isCheckedIn ? 'Estimated Wait' : 'Check-in Time'}</small>
          <strong>
            {isRejected || isCompleted ? '0 min' : (isCheckedIn ? `${currentToken?.estimatedWaitMinutes || 0} min` : (booking.slotId?.startTime || 'On arrival'))}
          </strong>
          <span>{isRejected || isCompleted ? 'Finalized' : (isCheckedIn ? 'Approximate wait' : 'Present code at entry')}</span>
        </div>
        <div className="queue-stat">
          <small>Operational Turn</small>
          <strong>
            {isRejected ? 'REJECTED' : isCompleted ? 'SERVED' : (isCheckedIn && queuePos != null ? `#${queuePos}` : '—')}
          </strong>
          <span>{isRejected || isCompleted ? 'Finished' : (isCheckedIn ? 'Order of service' : 'Generated on check-in')}</span>
        </div>
      </div>

      <section className="queue-timeline-section">
        <div>
          <span className="eyebrow">OPERATIONAL STATUS</span>
          <h2>{isCheckedIn ? 'Follow your queue progress' : 'Arrival & Token Instructions'}</h2>
          <p>
            {isCheckedIn
              ? 'Queue status is updated in real-time by centre staff.'
              : `Your slot is confirmed. When you arrive at ${booking.centreId?.name || 'the centre'}, present your booking code (${booking.bookingCode}) to staff for immediate check-in.`}
          </p>
        </div>

        {isCheckedIn ? (
          <div className="token-list">
            {items.map((item) => (
              <div className={`${item.status} you`} key={item._id}>
                <span><Clock3 size={15} /></span>
                <b>{item.queueNumber}</b>
                <small>{item.status?.replace('_', ' ')}</small>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#f8fafc', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
              ✓ <strong>Step 1:</strong> Arrive at the procurement centre 15 minutes before <strong>{booking.slotId?.startTime || 'your slot'}</strong>.
              <br />
              ✓ <strong>Step 2:</strong> Show booking code <strong>{booking.bookingCode}</strong> at the gate for token generation.
              <br />
              ✓ <strong>Step 3:</strong> Proceed for weighing and quality inspection once your token is called.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function ProcurementPage() {
  const { booking } = useLatestBooking();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (booking) {
      api.getProcurementStatus(booking._id)
        .then(setRecord)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [booking]);

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  const status = record?.status || booking?.status || 'pending';
  const isRejected = status === 'rejected' || booking?.status === 'rejected';
  const isCompleted = status === 'completed' || booking?.status === 'completed';
  const isPartial = status === 'partially_accepted' || record?.qualityStatus === 'partially_accepted';

  return (
    <div className="dashboard-page status-page">
      <div className="page-intro">
        <span className="eyebrow">PROCUREMENT STATUS</span>
        <h2>Stay informed through every stage.</h2>
        <p>{booking ? `Booking ${booking.bookingCode} • ${booking.centreId?.name || 'Selected Centre'}` : 'No active booking.'}</p>
      </div>

      <section className="status-timeline-card" style={{ marginBottom: 20 }}>
        <div className="timeline-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Procurement Stage &amp; Audit Status</h3>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Official verification, inspection, and weighing records</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {isRejected ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <h4 style={{ color: '#991b1b', margin: '0 0 6px', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={18} /> Procurement Rejected
            </h4>
            <p style={{ margin: '0 0 8px', color: '#b91c1c', fontSize: '0.95rem' }}>
              <strong>Rejection Reason:</strong> {record?.rejectionReason || booking?.cancellationReason || 'High moisture content or quality standard not met'}
            </p>
            {record?.qualityRemarks && (
              <p style={{ margin: '0 0 6px', color: '#7f1d1d', fontSize: '0.85rem' }}>
                <strong>Staff Remarks:</strong> {record.qualityRemarks}
              </p>
            )}
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>
              This lot was rejected during counter inspection. No payment settlement was generated.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid #e2e8f0' }}>
            <div>
              <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Booked Quantity</small>
              <b style={{ color: '#1e293b', fontSize: '1rem' }}>{booking?.bookedQuantity} {booking?.quantityUnit || 'kg'}</b>
            </div>
            <div>
              <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Actual Weighed</small>
              <b style={{ color: '#1e293b', fontSize: '1rem' }}>{record?.actualWeighedQuantity ?? booking?.bookedQuantity ?? '—'} {booking?.quantityUnit || 'kg'}</b>
            </div>
            <div>
              <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Accepted Quantity</small>
              <b style={{ color: '#0f673c', fontSize: '1rem' }}>{record?.acceptedQuantity ?? (isCompleted ? booking?.bookedQuantity : 'Pending')} {booking?.quantityUnit || 'kg'}</b>
            </div>
            {(isPartial || (record?.rejectedQuantity != null && record.rejectedQuantity > 0)) && (
              <div>
                <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Rejected / Deducted</small>
                <b style={{ color: '#dc2626', fontSize: '1rem' }}>{record?.rejectedQuantity || 0} {booking?.quantityUnit || 'kg'}</b>
              </div>
            )}
            <div>
              <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Quality Grade</small>
              <b style={{ color: '#1e293b', fontSize: '1rem' }}>{record?.qualityGrade || (isCompleted ? 'Grade A' : 'Pending inspection')}</b>
            </div>
            {record?.qualityRemarks && (
              <div style={{ gridColumn: '1 / -1' }}>
                <small style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Quality Remarks</small>
                <span style={{ color: '#334155', fontSize: '0.88rem' }}>{record.qualityRemarks}</span>
              </div>
            )}
          </div>
        )}

        <Timeline
          items={bookingStatuses.map((item) => ({
            title: item.replaceAll('_', ' '),
            description: item === status ? 'Current stage in procurement workflow.' : 'Workflow milestone.',
            status: bookingStatuses.indexOf(item) <= bookingStatuses.indexOf(status) ? 'done' : 'future'
          }))}
          current={status.replaceAll('_', ' ')}
        />
      </section>
    </div>
  );
}

export function PaymentPage() {
  const { booking } = useLatestBooking();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (booking) {
      api.getPaymentStatus(booking._id)
        .then(setPayment)
        .catch(() => setPayment(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [booking]);

  if (loading) return <div className="dashboard-page"><LoadingSpinner /></div>;

  const isRejected = booking?.status === 'rejected';

  return (
    <div className="dashboard-page payment-page">
      <div className="page-intro">
        <span className="eyebrow">PAYMENT STATUS</span>
        <h2>Settlement details, clearly visible.</h2>
        <p>Government procurement direct benefit transfer and settlement tracking.</p>
      </div>

      <section className="payment-card">
        {isRejected ? (
          <div style={{ padding: 24, textAlign: 'center', background: '#fef2f2', borderRadius: 14, border: '1px solid #fecaca' }}>
            <div style={{ color: '#dc2626', marginBottom: 8, display: 'inline-flex' }}>
              <AlertTriangle size={36} />
            </div>
            <h3 style={{ margin: '0 0 6px', color: '#991b1b', fontSize: '1.2rem' }}>Ineligible for Payment</h3>
            <p style={{ color: '#b91c1c', maxWidth: 460, margin: '0 auto 8px', fontSize: '0.9rem' }}>
              This procurement lot was rejected during inspection ({booking.cancellationReason || 'Quality criteria not satisfied'}).
            </p>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              No settlement or disbursement is initiated for rejected crop lots.
            </span>
          </div>
        ) : payment ? (
          <>
            <div className="payment-main">
              <span><CircleDollarSign size={26} /></span>
              <div>
                <small>PAYABLE AMOUNT</small>
                <strong>₹{Number(payment.payableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <p>Ref: {payment.paymentReference || 'Direct Bank Settlement'}</p>
              </div>
              <StatusBadge status={payment.paymentStatus} />
            </div>
            <div className="payment-details">
              <div>
                <small>Disbursement Status</small>
                <b>{payment.paymentStatus === 'initiated' ? 'Initiated (Processing Direct Credit)' : payment.paymentStatus}</b>
              </div>
              <div>
                <small>Date Processed</small>
                <b>{formatDate(payment.paidAt || payment.createdAt)}</b>
              </div>
              <div>
                <small>Beneficiary Centre</small>
                <b>{booking?.centreId?.name || 'Assigned Centre'}</b>
              </div>
              <div>
                <small>Remarks</small>
                <b>{payment.paymentRemarks || 'Automated direct procurement payout'}</b>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Clock3 size={30} />
            <h3>No settlement record yet</h3>
            <p>
              {booking?.status === 'completed'
                ? 'Your crop was procured. Settlement generation is synchronizing...'
                : 'A settlement record will automatically generate once centre staff completes weighing and accepts your crop.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function NotificationsPage() { const [items, setItems] = useState([]); const { notify } = useApp(); useEffect(() => { api.getNotifications().then(setItems).catch((error) => notify(errorText(error), 'error')); }, []); const markAll = async () => { await api.markAllNotificationsRead(); setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() }))); }; return <div className="dashboard-page notifications-page"><div className="page-intro split"><div><span className="eyebrow">NOTIFICATIONS</span><h2>Keep up with your procurement.</h2><p>{items.filter((item) => !item.readAt).length} unread updates.</p></div><Button variant="secondary" onClick={markAll}>Mark all as read</Button></div><section className="notification-list">{items.map((item) => <article key={item._id} className={!item.readAt ? 'unread' : ''} onClick={() => !item.readAt && api.markNotificationRead(item._id).then(() => setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, readAt: new Date().toISOString() } : entry)))}><span className={`notification-icon ${item.type}`}><Bell /></span><div><b>{item.title}</b><p>{item.message}</p></div>{!item.readAt && <i aria-label="Unread"></i>}</article>)}</section></div>; }

export function FarmerProfilePage() {
  const { user } = useApp();
  return (
    <div className="dashboard-page">
      <div className="page-intro">
        <span className="eyebrow">FARMER PROFILE</span>
        <h2>Your account details</h2>
        <p>Profile data is loaded from your authenticated account.</p>
      </div>
      <section className="profile-card">
        <span className="profile-avatar">{user?.name?.slice(0, 2).toUpperCase()}</span>
        <div>
          <h3>{user?.name}</h3>
          <p>{user?.role} • Preferred language: {user?.preferredLanguage}</p>
        </div>
        <div className="profile-grid">
          <span><small>Mobile</small><b>{user?.mobile || 'Not provided'}</b></span>
          <span><small>Email</small><b>{user?.email || 'Not provided'}</b></span>
          <span><small>State / District</small><b>{user?.district ? `${user.district}, ${user.state || ''}` : user?.state || 'Not provided'}</b></span>
          <span><small>Village</small><b>{user?.village || 'Not provided'}</b></span>
          <span><small>Account status</small><b>{user?.status}</b></span>
          <span><small>Role</small><b>{user?.role}</b></span>
        </div>
      </section>
    </div>
  );
}

