import { Bell, CalendarCheck2, Check, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, FileCheck2, MapPin, Radio, ReceiptText, Sprout, UsersRound, Wheat } from 'lucide-react';
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

    return (
      <div className="dashboard-page booking-page">
        <div className="page-intro">
          <span className="eyebrow">ACTIVE PROCUREMENT DETECTED</span>
          <h2>You already have an active booking</h2>
          <p>
            To prevent congestion and ensure fair access, each farmer may hold only one active procurement booking at a time.
            Please complete or cancel your existing booking before booking another slot.
          </p>
        </div>

        <section
          className="today-status active-booking-card"
          style={{
            background: 'linear-gradient(135deg, #07351f 0%, #0b482b 55%, #0f673c 100%)',
            border: '1px solid rgba(217, 143, 8, 0.35)',
            boxShadow: '0 12px 32px rgba(7, 53, 31, 0.22), 0 2px 6px rgba(0, 0, 0, 0.08)',
            color: '#ffffff',
            borderRadius: 16,
            padding: 26,
            marginBottom: 30,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div className="today-status-top" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: 'rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  marginBottom: 10
                }}
              >
                <i style={{ width: 7, height: 7, borderRadius: '50%', background: '#facc15', display: 'inline-block' }} />
                {String(b.status).replace('_', ' ')}
              </span>
              <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', margin: '6px 0 4px', letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
                Active Booking in Progress
              </h2>
              <p style={{ fontSize: '0.92rem', color: '#e0ebe1', margin: 0, fontWeight: 500 }}>
                {centreName}
              </p>
            </div>
            <div
              style={{
                textAlign: 'center',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(217, 143, 8, 0.45)',
                borderRadius: 12,
                padding: '10px 16px',
                minWidth: 140
              }}
            >
              <small style={{ display: 'block', fontSize: '0.66rem', letterSpacing: '0.12em', color: '#fef08a', fontWeight: 800, textTransform: 'uppercase' }}>
                BOOKING ID
              </small>
              <b style={{ display: 'block', fontSize: '1.15rem', color: '#ffffff', letterSpacing: '-0.01em', marginTop: 3, fontWeight: 800 }}>
                {b.bookingCode}
              </b>
            </div>
          </div>

          <div
            className="today-details"
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              marginTop: 22,
              paddingTop: 18,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 24
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
              <span style={{ color: '#facc15', display: 'grid', placeItems: 'center' }}>
                <MapPin size={22} />
              </span>
              <span>
                <small style={{ display: 'block', color: '#bbf7d0', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Procurement Centre
                </small>
                <b style={{ display: 'block', color: '#ffffff', fontSize: '0.92rem', fontWeight: 700, marginTop: 1 }}>
                  {centreName}
                </b>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
              <span style={{ color: '#facc15', display: 'grid', placeItems: 'center' }}>
                <Clock3 size={22} />
              </span>
              <span>
                <small style={{ display: 'block', color: '#bbf7d0', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Date &amp; Slot
                </small>
                <b style={{ display: 'block', color: '#ffffff', fontSize: '0.92rem', fontWeight: 700, marginTop: 1 }}>
                  {formatDate(b.bookingDate)} ({slotTime})
                </b>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
              <span style={{ color: '#facc15', display: 'grid', placeItems: 'center' }}>
                <Wheat size={22} />
              </span>
              <span>
                <small style={{ display: 'block', color: '#bbf7d0', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Commodity &amp; Quantity
                </small>
                <b style={{ display: 'block', color: '#ffffff', fontSize: '0.92rem', fontWeight: 700, marginTop: 1 }}>
                  {commodityTitle} · {b.bookedQuantity} {b.quantityUnit || 'kg'}
                </b>
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
              <Link
                to="/farmer/booking"
                style={{
                  background: '#ffffff',
                  color: '#07351f',
                  fontWeight: 750,
                  fontSize: '0.82rem',
                  padding: '10px 18px',
                  borderRadius: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  transition: '0.2s ease'
                }}
              >
                View booking details
                <ChevronRight size={16} />
              </Link>
              <Link
                to="/farmer/queue"
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.45)',
                  fontWeight: 750,
                  fontSize: '0.82rem',
                  padding: '10px 18px',
                  borderRadius: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  transition: '0.2s ease'
                }}
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
  const activeStatus = currentToken ? currentToken.status : booking.status;

  // Queue position and farmers ahead calculation from operational queue entry
  const queuePos = currentToken?.queuePosition;
  const farmersAhead = currentToken?.farmersAhead;

  // Determine formal message
  let formalMessage = '';
  if (booking.status === 'cancelled' || activeStatus === 'cancelled') {
    formalMessage = 'This booking has been cancelled.';
  } else if (booking.status === 'no_show' || activeStatus === 'no_show') {
    formalMessage = 'You were marked as no-show for this booking. Please contact the procurement centre if you need assistance.';
  } else if (activeStatus === 'served' || booking.status === 'completed') {
    formalMessage = 'Your procurement has been completed successfully.';
  } else if (activeStatus === 'processing') {
    formalMessage = 'Your procurement is currently being processed. Please follow the instructions from centre staff.';
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
            {activeStatus === 'processing' ? 'IN SERVICE' : isCheckedIn ? 'QUEUE POSITION' : 'BOOKING STATUS'}
          </span>
          <div
            style={{
              fontSize: '2.8rem',
              fontWeight: 800,
              lineHeight: 1.05,
              color: activeStatus === 'processing' ? '#2563eb' : (isCheckedIn ? '#0f673c' : '#1e293b'),
              letterSpacing: '-0.04em'
            }}
          >
            {activeStatus === 'processing'
              ? 'NOW'
              : (isCheckedIn && queuePos != null ? `#${queuePos}` : (isCheckedIn && currentToken.queueNumber ? currentToken.queueNumber : 'CONFIRMED'))}
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: activeStatus === 'processing' ? '#2563eb' : (farmersAhead === 0 ? '#059669' : '#d97706'),
              marginTop: 6
            }}
          >
            {activeStatus === 'processing'
              ? 'Currently processing'
              : isCheckedIn && farmersAhead != null
                ? (farmersAhead === 0 ? "You're next in line" : `${farmersAhead} farmers ahead of you`)
                : (isCheckedIn ? 'In queue' : 'Awaiting check-in')}
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
              color: '#0f673c',
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
            <span>Token: <strong style={{ color: '#0f673c' }}>{currentToken?.queueNumber || 'Pending check-in'}</strong></span>
            <span>Est. Wait: <strong style={{ color: '#1e293b' }}>{currentToken?.estimatedWaitMinutes != null ? `${currentToken.estimatedWaitMinutes} min` : 'Calculated at entry'}</strong></span>
            <span>Total Active in Queue: <strong style={{ color: '#1e293b' }}>{currentToken?.totalActiveInQueue || (isCheckedIn ? 1 : 0)}</strong></span>
          </div>
        </div>
      </section>

      <div className="queue-overview">
        <div className="queue-stat">
          <small>{isCheckedIn ? 'Queue Token' : 'Current Status'}</small>
          <strong>{isCheckedIn ? currentToken.queueNumber : 'CONFIRMED'}</strong>
          <span>{isCheckedIn ? 'Assigned at check-in' : 'Awaiting arrival at centre'}</span>
        </div>
        <div className="queue-stat">
          <small>Farmers Ahead</small>
          <strong>
            {isCheckedIn && farmersAhead != null ? farmersAhead : (isCheckedIn ? 0 : '—')}
          </strong>
          <span>{isCheckedIn ? (farmersAhead === 0 ? "You're next" : 'Ahead in queue') : 'Prior to check-in'}</span>
        </div>
        <div className="queue-stat highlight">
          <small>{isCheckedIn ? 'Estimated Wait' : 'Check-in Time'}</small>
          <strong>
            {isCheckedIn ? `${currentToken?.estimatedWaitMinutes || 0} min` : (booking.slotId?.startTime || 'On arrival')}
          </strong>
          <span>{isCheckedIn ? 'Approximate wait' : 'Present code at entry'}</span>
        </div>
        <div className="queue-stat">
          <small>Operational Turn</small>
          <strong>
            {isCheckedIn && queuePos != null ? `#${queuePos}` : '—'}
          </strong>
          <span>{isCheckedIn ? 'Order of service' : 'Generated on check-in'}</span>
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

export function ProcurementPage() { const { booking } = useLatestBooking(); const [record, setRecord] = useState(null); useEffect(() => { if (booking) api.getProcurementStatus(booking._id).then(setRecord).catch(() => { }); }, [booking]); const status = record?.status || booking?.status || 'pending'; const items = bookingStatuses.map((item) => ({ title: item.replaceAll('_', ' '), description: item === status ? 'Current procurement status.' : 'Status recorded by the procurement workflow.', status: bookingStatuses.indexOf(item) <= bookingStatuses.indexOf(status) ? 'done' : 'future' })); return <div className="dashboard-page status-page"><div className="page-intro"><span className="eyebrow">PROCUREMENT STATUS</span><h2>Stay informed through every stage.</h2><p>{booking ? `Booking ${booking.bookingCode}` : 'No active booking.'}</p></div><section className="status-timeline-card"><div className="timeline-heading"><div><h3>Procurement progress</h3><p>Latest status from the backend</p></div><StatusBadge status={status} /></div><Timeline items={items} current={status.replaceAll('_', ' ')} /></section></div>; }

export function PaymentPage() { const { booking } = useLatestBooking(); const [payment, setPayment] = useState(null); useEffect(() => { if (booking) api.getPaymentStatus(booking._id).then(setPayment).catch(() => { }); }, [booking]); return <div className="dashboard-page payment-page"><div className="page-intro"><span className="eyebrow">PAYMENT STATUS</span><h2>Settlement details, clearly visible.</h2><p>Payment records are maintained by authorized staff and administrators.</p></div><section className="payment-card">{payment ? <><div className="payment-main"><span><CircleDollarSign size={26} /></span><div><small>PAYABLE AMOUNT</small><strong>{payment.payableAmount ?? 'Not set'}</strong><p>{payment.paymentReference || 'No payment reference yet'}</p></div><StatusBadge status={payment.paymentStatus} /></div><div className="payment-details"><div><small>Status</small><b>{payment.paymentStatus}</b></div><div><small>Paid at</small><b>{formatDate(payment.paidAt)}</b></div></div></> : <div className="empty-state"><Clock3 size={30} /><h3>No settlement record</h3><p>A settlement record will appear after procurement processing.</p></div>}</section></div>; }

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

