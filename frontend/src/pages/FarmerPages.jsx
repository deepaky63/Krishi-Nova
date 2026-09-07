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

        <section className="today-status" style={{ border: '1px solid #10b981', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)' }}>
          <div className="today-status-top">
            <div>
              <StatusBadge status={b.status} />
              <h2 style={{ marginTop: 8 }}>Active Booking in Progress</h2>
              <p>{centreName}</p>
            </div>
            <span className="token-chip">BOOKING <b>{b.bookingCode}</b></span>
          </div>
          <div className="today-details">
            <div>
              <MapPin />
              <span>
                <small>Procurement Centre</small>
                <b>{centreName}</b>
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                <small>Date &amp; Slot</small>
                <b>{formatDate(b.bookingDate)} ({slotTime})</b>
              </span>
            </div>
            <div>
              <Wheat />
              <span>
                <small>Commodity &amp; Quantity</small>
                <b>{commodityTitle} · {b.bookedQuantity} {b.quantityUnit || 'kg'}</b>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <Button to="/farmer/booking">View booking details</Button>
              <Button to="/farmer/queue" variant="secondary">Live queue</Button>
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

  useEffect(() => {
    if (!booking) {
      setLoading(false);
      return;
    }
    let socket;
    api.getBookingQueue(booking._id).then((result) => {
      setItems(Array.isArray(result) ? result : []);
      const entry = result[0];
      if (entry && getAccessToken()) {
        const centreId = entry.centreId?._id || entry.centreId;
        const slotId = entry.slotId?._id || entry.slotId;
        socket = connectQueueSocket(getAccessToken(), {
          updated: (next) => setItems((current) => current.map((item) => item._id === next._id ? next : item))
        });
        socket.emit('queue:join', { bookingId: booking._id, centreId, slotId, date: booking.bookingDate });
      }
    }).catch(() => setItems([])).finally(() => setLoading(false));
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

  return (
    <div className="dashboard-page queue-page">
      <div className="live-label">
        <Radio size={16} /> Live queue <span>Connected to operational updates</span>
      </div>

      <section className="today-status" style={{ marginBottom: 20 }}>
        <div className="today-status-top">
          <div>
            <StatusBadge status={isCheckedIn ? currentToken.status : booking.status} />
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

      <div className="queue-overview">
        <div className="queue-stat">
          <small>{isCheckedIn ? 'Queue Token' : 'Current Status'}</small>
          <strong>{isCheckedIn ? currentToken.queueNumber : 'CONFIRMED'}</strong>
          <span>{isCheckedIn ? 'Assigned at check-in' : 'Awaiting arrival at centre'}</span>
        </div>
        <div className="queue-stat highlight">
          <small>{isCheckedIn ? 'Estimated Wait' : 'Check-in Time'}</small>
          <strong>
            {isCheckedIn ? `${currentToken?.estimatedWaitMinutes || 0} min` : (booking.slotId?.startTime || 'On arrival')}
          </strong>
          <span>{isCheckedIn ? 'Approximate wait' : 'Present code at entry'}</span>
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
              <div className={item.status} key={item._id}>
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

