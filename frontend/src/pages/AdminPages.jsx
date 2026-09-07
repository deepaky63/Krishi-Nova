import { BarChart3, Building2, Calendar, CalendarRange, Check, Clock3, Eye, Gauge, Layers, ListFilter, Settings2, Sparkles, UsersRound, X } from 'lucide-react';

import { useEffect, useState } from 'react';
import { Button, LoadingSpinner, Modal, StatCard, StatusBadge } from '../components/UI';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

const errorText = (error) => error.response?.data?.message || 'Unable to load admin data.';

export function AdminDashboard() {
  const [data, setData] = useState(null);
  const { notify } = useApp();
  useEffect(() => {
    api.getAdminDashboard().then(setData).catch((error) => notify(errorText(error), 'error'));
  }, []);
  if (!data) return <div className="dashboard-page"><LoadingSpinner /></div>;
  return (
    <div className="dashboard-page admin-page">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">PROCUREMENT OVERVIEW</span>
          <h2>District procurement overview</h2>
          <p>Metrics are calculated from the current database.</p>
        </div>
        <Button to="/admin/centres">Manage centres</Button>
      </div>
      <section className="admin-stats">
        <StatCard icon={Building2} value={data.totalCentres} label="Active centres" note="Current database" accent="blue" />
        <StatCard icon={UsersRound} value={data.totalFarmers} label="Active farmers" note="Registered accounts" accent="green" />
        <StatCard icon={Gauge} value={data.activeBookings} label="Active bookings" note="Capacity-consuming records" accent="gold" />
        <StatCard icon={BarChart3} value="—" label="Procurement value" note="Settlement analytics pending" accent="blue" />
        <StatCard icon={Clock3} value="—" label="Average waiting" note="Calculated from queue history" accent="green" />
      </section>
      <section className="analytics-note">
        <BarChart3 />
        <div><b>Analytics data is operational</b><p>Detailed charts will appear as procurement and queue history accumulates.</p></div>
      </section>
    </div>
  );
}

export function AdminCentresPage() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const { notify } = useApp();
  const load = () => api.getCentres({ status: 'active' }).then((result) => setItems(result.items || result)).catch((error) => notify(errorText(error), 'error'));
  useEffect(() => { load(); }, []);
  const save = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = { centreCode: data.centreCode, name: data.name, address: data.address, district: data.district, state: data.state, status: 'active' };
      if (editing?._id) await api.updateCentre(editing._id, payload);
      else await api.createCentre(payload);
      setEditing(null);
      await load();
      notify('Centre saved.');
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };
  return (
    <div className="dashboard-page admin-page">
      <div className="page-intro split">
        <div><span className="eyebrow">CENTRE MANAGEMENT</span><h2>Manage procurement centres</h2><p>Only administrators can change centre configuration.</p></div>
        <Button onClick={() => setEditing({})}>Add centre</Button>
      </div>
      <section className="admin-table-card">
        <table className="admin-table">
          <thead><tr><th>Centre</th><th>District</th><th>Address</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td><b>{item.name}</b><small>{item.centreCode}</small></td>
                <td>{item.district}</td>
                <td>{item.address}</td>
                <td><StatusBadge status={item.status} /></td>
                <td><button className="text-button" onClick={() => setEditing(item)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {editing && (
        <Modal title={editing._id ? 'Edit procurement centre' : 'Add procurement centre'} onClose={() => setEditing(null)}>
          <form className="modal-form" onSubmit={save}>
            <label>Centre code<input name="centreCode" defaultValue={editing.centreCode || ''} required /></label>
            <label>Centre name<input name="name" defaultValue={editing.name || ''} required /></label>
            <label className="full">Address<input name="address" defaultValue={editing.address || ''} required /></label>
            <label>District<input name="district" defaultValue={editing.district || ''} required /></label>
            <label>State<input name="state" defaultValue={editing.state || ''} required /></label>
            <div className="modal-actions full">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save centre</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function AdminAnalyticsPage() {
  return (
    <div className="dashboard-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">ANALYTICS</span>
        <h2>Operational signals across centres</h2>
        <p>Analytics will be calculated from real bookings, queue and procurement records.</p>
      </div>
      <section className="analytics-note">
        <BarChart3 />
        <div><b>No historical data yet</b><p>Charts will populate as the empty production database receives operational records.</p></div>
      </section>
    </div>
  );
}

export function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [centres, setCentres] = useState([]);
  const [editing, setEditing] = useState(null);
  const [centreIds, setCentreIds] = useState([]);
  const { notify } = useApp();
  const load = async () => {
    try {
      const [staffData, centreData] = await Promise.all([api.getStaffUsers(), api.getCentres({ status: 'active' })]);
      setStaff(staffData);
      setCentres(centreData.items || centreData);
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };
  useEffect(() => { load(); }, []);
  const openCreate = () => { setEditing({}); setCentreIds([]); };
  const openEdit = (item) => { setEditing(item); setCentreIds((item.assignedCentreIds || []).map((centre) => centre._id || centre)); };
  const save = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { name: data.name, email: data.email, mobile: data.mobile, loginId: data.loginId || undefined, preferredLanguage: data.preferredLanguage, assignedCentreIds: centreIds };
    if (!editing?._id) payload.password = data.password;
    try {
      if (editing?._id) await api.updateStaff(editing._id, payload);
      else await api.createStaff(payload);
      setEditing(null);
      await load();
      notify(editing?._id ? 'Staff account updated.' : 'Staff account created.');
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };
  const toggleStatus = async (item) => {
    const status = item.status === 'active' ? 'suspended' : 'active';
    try {
      await api.updateStaff(item._id, { status });
      await load();
      notify(status === 'active' ? 'Staff account activated.' : 'Staff account suspended.');
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };
  return (
    <div className="dashboard-page admin-page">
      <div className="page-intro split">
        <div><span className="eyebrow">STAFF MANAGEMENT</span><h2>Manage centre staff</h2><p>Create staff accounts and control their assigned procurement centres.</p></div>
        <Button onClick={openCreate}>Create Staff</Button>
      </div>
      <section className="admin-table-card">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Login ID</th><th>Contact</th><th>Assigned centres</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {staff.map((item) => (
              <tr key={item._id}>
                <td><b>{item.name}</b><small>{item.role}</small></td>
                <td><code>{item.loginId || '—'}</code></td>
                <td><small>{item.email}</small><small>{item.mobile}</small></td>
                <td>{item.assignedCentreIds?.length ? item.assignedCentreIds.map((centre) => centre.name || centre).join(', ') : 'No centres assigned'}</td>
                <td><StatusBadge status={item.status} /></td>
                <td>
                  <button className="text-button" onClick={() => openEdit(item)}>Edit</button>{' '}
                  <button className="text-button" onClick={() => toggleStatus(item)}>{item.status === 'active' ? 'Deactivate' : 'Reactivate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!staff.length && <div className="empty-state"><UsersRound size={30} /><h3>No staff accounts</h3><p>Create the first staff account for your procurement centres.</p></div>}
      </section>
      {editing && (
        <Modal title={editing._id ? 'Edit staff account' : 'Create staff account'} onClose={() => setEditing(null)}>
          <form className="modal-form" onSubmit={save}>
            <label>Staff name<input name="name" defaultValue={editing.name || ''} required /></label>
            {!editing._id && <label>Login ID (optional)<input name="loginId" placeholder="e.g. STAFF-001 (auto-generated if empty)" /></label>}
            <label>Email<input name="email" type="email" defaultValue={editing.email || ''} required /></label>
            <label>Mobile number<input name="mobile" inputMode="numeric" maxLength="10" defaultValue={editing.mobile || ''} required /></label>
            {!editing._id && <label>Password<input name="password" type="password" minLength="8" required /></label>}
            <label>Preferred language
              <select name="preferredLanguage" defaultValue={editing.preferredLanguage || 'en'}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </label>
            <label className="full">Assigned procurement centres
              <select className="multi-select" multiple value={centreIds} onChange={(event) => setCentreIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
                {centres.map((centre) => <option key={centre._id} value={centre._id}>{centre.name} · {centre.district}</option>)}
              </select>
            </label>
            <div className="modal-actions full">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">{editing._id ? 'Save changes' : 'Create Staff'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Day Labels & Constants ──────────────────────────────────────────────────
const DAY_LABELS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

const padZero = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;

// ─── 1. Configure Procurement Schedule Modal (PRIMARY AUTOMATED GENERATOR) ──
function CreateScheduleModal({ isOpen, onClose, centres, onScheduleCreated }) {
  const today = new Date();
  const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [centreId, setCentreId] = useState('');
  const [name, setName] = useState('');
  const [selectedCommodities, setSelectedCommodities] = useState([]);
  const [commodityInput, setCommodityInput] = useState('');
  const [commodityError, setCommodityError] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(toDateInput(today));
  const [effectiveUntil, setEffectiveUntil] = useState(toDateInput(twoWeeksLater));
  const [daysOfWeek, setDaysOfWeek] = useState([1, 2, 3, 4, 5, 6]); // Mon-Sat default
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('17:00');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const [maxFarmersPerSlot, setMaxFarmersPerSlot] = useState(20);
  const [maxQuantityPerSlot, setMaxQuantityPerSlot] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('kg');
  const [bookingCutoffMinutes, setBookingCutoffMinutes] = useState(60);

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Add commodity tag
  const addCommodity = () => {
    const trimmed = commodityInput.trim();
    if (!trimmed) return;
    setCommodityError('');
    if (selectedCommodities.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setCommodityError(`"${trimmed}" is already added.`);
      return;
    }
    setSelectedCommodities((prev) => [...prev, trimmed]);
    setCommodityInput('');
  };

  const removeCommodity = (item) => {
    setSelectedCommodities((prev) => prev.filter((c) => c !== item));
  };

  const toggleDay = (dayNum) => {
    setDaysOfWeek((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort()
    );
  };

  // Live client-side preview calculation
  useEffect(() => {
    if (!effectiveFrom || !effectiveUntil || !openingTime || !closingTime || !slotDurationMinutes) {
      setPreview(null);
      return;
    }
    const [startH, startM] = openingTime.split(':').map(Number);
    const [endH, endM] = closingTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins >= endMins || slotDurationMinutes <= 0) {
      setPreview(null);
      return;
    }

    const slotsPerDay = Math.floor((endMins - startMins) / slotDurationMinutes);
    const fromD = new Date(effectiveFrom);
    const untilD = new Date(effectiveUntil);

    if (fromD > untilD) {
      setPreview(null);
      return;
    }

    let workingDaysCount = 0;
    const cur = new Date(fromD);
    while (cur <= untilD) {
      if (daysOfWeek.includes(cur.getDay())) {
        workingDaysCount += 1;
      }
      cur.setDate(cur.getDate() + 1);
    }

    setPreview({
      workingDaysCount,
      slotsPerDay,
      totalSlots: workingDaysCount * slotsPerDay,
      duration: slotDurationMinutes,
    });
  }, [effectiveFrom, effectiveUntil, daysOfWeek, openingTime, closingTime, slotDurationMinutes]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!centreId) {
      setFormError('Please select a procurement centre.');
      return;
    }
    if (selectedCommodities.length === 0) {
      setFormError('Please add at least one supported commodity.');
      return;
    }
    if (daysOfWeek.length === 0) {
      setFormError('Please select at least one operating day of the week.');
      return;
    }
    if (!preview || preview.totalSlots === 0) {
      setFormError('Operating hours and date range must yield at least one valid slot.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        centreId,
        name: name || undefined,
        supportedCommodities: selectedCommodities,
        effectiveFrom,
        effectiveUntil,
        daysOfWeek,
        openingTime,
        closingTime,
        slotDurationMinutes: Number(slotDurationMinutes),
        maxFarmersPerSlot: Number(maxFarmersPerSlot),
        maxQuantityPerSlot: maxQuantityPerSlot ? Number(maxQuantityPerSlot) : undefined,
        quantityUnit: quantityUnit || 'kg',
        bookingCutoffMinutes: Number(bookingCutoffMinutes) || 60,
      };

      await api.createSchedule(payload);
      if (onScheduleCreated) onScheduleCreated();
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to generate procurement schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="slot-modal schedule-generator-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Configure Procurement Schedule"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 680 }}
      >
        <div className="slot-modal-header">
          <div>
            <span className="eyebrow" style={{ color: 'var(--primary, #16a34a)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={14} /> AUTOMATED BATCH SCHEDULE GENERATOR
            </span>
            <h2 className="slot-modal-title">Configure Procurement Schedule</h2>
          </div>
          <button type="button" className="slot-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="slot-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {formError && <div className="slot-alert-error">{formError}</div>}

            <div className="slot-form-grid">
              {/* Centre Selection */}
              <div className="slot-field slot-field--full">
                <label htmlFor="sched-centreId" className="slot-label">Procurement Centre *</label>
                <select
                  id="sched-centreId"
                  required
                  value={centreId}
                  onChange={(e) => setCentreId(e.target.value)}
                  className="slot-input"
                >
                  <option value="" disabled>Select centre…</option>
                  {(centres || []).map((c) => (
                    <option key={c._id} value={c._id}>{c.name} · {c.district}</option>
                  ))}
                </select>
              </div>

              {/* Schedule Name (Optional) */}
              <div className="slot-field slot-field--full">
                <label htmlFor="sched-name" className="slot-label">
                  Schedule Name (optional)
                  <span className="slot-label-hint"> — e.g. Rabi 2026 Wheat Procurement</span>
                </label>
                <input
                  id="sched-name"
                  type="text"
                  placeholder="Auto-generated if left blank"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="slot-input"
                />
              </div>

              {/* Supported Commodities — Admin-entered free text */}
              <div className="slot-field slot-field--full">
                <label htmlFor="sched-commodity" className="slot-label">
                  Supported Commodities *
                  <span className="slot-label-hint"> — type commodity &amp; click Add or press Enter</span>
                </label>
                <div className="slot-commodity-row">
                  <input
                    id="sched-commodity"
                    type="text"
                    placeholder="e.g. Wheat, Rice, Mustard, Potato…"
                    value={commodityInput}
                    onChange={(e) => { setCommodityInput(e.target.value); setCommodityError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCommodity(); } }}
                    className="slot-input slot-commodity-input"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary slot-add-btn"
                    onClick={addCommodity}
                  >
                    Add
                  </button>
                </div>
                {commodityError && <p className="slot-field-error">{commodityError}</p>}
                <div className="slot-chips">
                  {selectedCommodities.map((item) => (
                    <span key={item} className="slot-chip">
                      <span className="slot-chip-name">{item}</span>
                      <button
                        type="button"
                        className="slot-chip-remove"
                        onClick={() => removeCommodity(item)}
                        aria-label={`Remove ${item}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {selectedCommodities.length === 0 && (
                    <span className="slot-chips-empty">No commodities selected yet. (Admin enters custom commodities)</span>
                  )}
                </div>
              </div>

              {/* Effective From */}
              <div className="slot-field">
                <label htmlFor="sched-from" className="slot-label">Effective From *</label>
                <input
                  id="sched-from"
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="slot-input"
                />
              </div>

              {/* Effective Until */}
              <div className="slot-field">
                <label htmlFor="sched-until" className="slot-label">Effective Until *</label>
                <input
                  id="sched-until"
                  type="date"
                  required
                  value={effectiveUntil}
                  onChange={(e) => setEffectiveUntil(e.target.value)}
                  className="slot-input"
                />
              </div>

              {/* Working Days */}
              <div className="slot-field slot-field--full">
                <label className="slot-label">Operating Days of Week *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {DAY_LABELS.map(({ day, label }) => {
                    const active = daysOfWeek.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`text-button ${active ? 'active-day-pill' : ''}`}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 20,
                          border: active ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                          background: active ? '#f0fdf4' : '#ffffff',
                          color: active ? '#166534' : '#64748b',
                          fontWeight: active ? 600 : 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {active && <Check size={14} />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opening Time */}
              <div className="slot-field">
                <label htmlFor="sched-open" className="slot-label">Opening Time *</label>
                <input
                  id="sched-open"
                  type="time"
                  required
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="slot-input"
                />
              </div>

              {/* Closing Time */}
              <div className="slot-field">
                <label htmlFor="sched-close" className="slot-label">Closing Time *</label>
                <input
                  id="sched-close"
                  type="time"
                  required
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="slot-input"
                />
              </div>

              {/* Slot Duration */}
              <div className="slot-field">
                <label htmlFor="sched-duration" className="slot-label">Slot Duration *</label>
                <select
                  id="sched-duration"
                  value={slotDurationMinutes}
                  onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
                  className="slot-input"
                >
                  <option value={15}>15 minutes (High frequency)</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes (Standard)</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={120}>120 minutes</option>
                </select>
              </div>

              {/* Farmers per Slot */}
              <div className="slot-field">
                <label htmlFor="sched-capacity" className="slot-label">Farmers / Slot *</label>
                <input
                  id="sched-capacity"
                  type="number"
                  min="1"
                  required
                  value={maxFarmersPerSlot}
                  onChange={(e) => setMaxFarmersPerSlot(e.target.value)}
                  className="slot-input"
                  placeholder="e.g. 20"
                />
              </div>

              {/* Quantity per Slot */}
              <div className="slot-field">
                <label htmlFor="sched-qty" className="slot-label">Max Quantity / Slot (optional)</label>
                <input
                  id="sched-qty"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={maxQuantityPerSlot}
                  onChange={(e) => setMaxQuantityPerSlot(e.target.value)}
                  className="slot-input"
                  placeholder="e.g. 500"
                />
              </div>

              {/* Quantity Unit */}
              <div className="slot-field">
                <label htmlFor="sched-unit" className="slot-label">Quantity Unit</label>
                <input
                  id="sched-unit"
                  type="text"
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  className="slot-input"
                  placeholder="kg"
                />
              </div>

              {/* Booking Cutoff */}
              <div className="slot-field slot-field--full">
                <label htmlFor="sched-cutoff" className="slot-label">Booking Cutoff (minutes before slot)</label>
                <input
                  id="sched-cutoff"
                  type="number"
                  min="0"
                  value={bookingCutoffMinutes}
                  onChange={(e) => setBookingCutoffMinutes(e.target.value)}
                  className="slot-input"
                  placeholder="60"
                />
              </div>
            </div>

            {/* LIVE PREVIEW BANNER STEP */}
            {preview && preview.totalSlots > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: '14px 18px',
                  borderRadius: 8,
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderLeft: '4px solid #16a34a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600, fontSize: 14 }}>
                  <CalendarRange size={18} />
                  <span>Generation Preview</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                  This schedule will generate approximately <strong>{preview.totalSlots} bookable slots</strong> (
                  {preview.workingDaysCount} working days × {preview.slotsPerDay} slots/day at {preview.duration}m intervals).
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                  Daily windows: {openingTime} to {closingTime}. Overlapping existing slots will be preserved.
                </p>
              </div>
            )}
          </div>

          <div className="slot-modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !preview || preview.totalSlots === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={16} />
              {submitting ? 'Generating Slots…' : `Generate Schedule (${preview?.totalSlots || 0} Slots)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 2. Inspect Generated Slots Modal ────────────────────────────────────────
function InspectScheduleSlotsModal({ isOpen, onClose, schedule }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    if (!isOpen || !schedule?._id) return;
    setLoading(true);
    api.getAdminScheduleSlots(schedule._id, filterDate ? { date: filterDate } : {})
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [isOpen, schedule, filterDate]);

  if (!isOpen || !schedule) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="slot-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Inspect Generated Slots"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 840 }}
      >
        <div className="slot-modal-header">
          <div>
            <span className="eyebrow">{schedule.centreId?.name || 'Centre'}</span>
            <h2 className="slot-modal-title">{schedule.name || 'Generated Slots'}</h2>
            <small style={{ color: '#64748b' }}>
              {schedule.supportedCommodities?.join(', ')} · {schedule.slotDurationMinutes}m intervals · {schedule.maxFarmersPerSlot} farmers/slot
            </small>
          </div>
          <button type="button" className="slot-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="slot-modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
              Showing {slots.length} generated slots
            </span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="slot-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: 13 }}
              placeholder="Filter by date"
            />
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : slots.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <Clock3 size={24} />
              <p>No slots found for the selected date.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time Window</th>
                    <th>Capacity (Remaining)</th>
                    <th>Current Bookings</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={s._id}>
                      <td><b>{new Date(s.date).toLocaleDateString('en-IN')}</b></td>
                      <td><code>{s.startTime} – {s.endTime}</code></td>
                      <td>
                        {s.remainingCapacity} / {s.maxFarmers} farmers
                        {s.maxQuantity != null && <small>{s.quantityUnit || 'kg'}</small>}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: s.currentBookings > 0 ? '#16a34a' : '#64748b' }}>
                          {s.currentBookings}
                        </span>
                      </td>
                      <td><StatusBadge status={s.active ? 'active' : 'inactive'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="slot-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 3. Ad-hoc Single Slot Modal (SECONDARY MANUAL CREATION FOR EXCEPTIONS) ──
function CreateSlotModal({ isOpen, onClose, centreId, centres, onSlotCreated }) {
  const [selectedCommodities, setSelectedCommodities] = useState([]);
  const [commodityInput, setCommodityInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    centreId: centreId || '',
    date: '',
    startTime: '',
    endTime: '',
    maxFarmers: '',
    maxQuantity: '',
    quantityUnit: 'kg',
    bookingCutoffMinutes: '60',
    active: true,
  });

  useEffect(() => {
    if (!isOpen) {
      setSelectedCommodities([]);
      setCommodityInput('');
      setSearchError('');
      setFormError('');
      setFormData({
        centreId: centreId || '',
        date: '',
        startTime: '',
        endTime: '',
        maxFarmers: '',
        maxQuantity: '',
        quantityUnit: 'kg',
        bookingCutoffMinutes: '60',
        active: true,
      });
    }
  }, [isOpen, centreId]);

  if (!isOpen) return null;

  const addCommodity = () => {
    const name = commodityInput.trim();
    if (!name) return;
    setSearchError('');
    if (selectedCommodities.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setSearchError(`"${name}" is already added.`);
      return;
    }
    setSelectedCommodities((prev) => [...prev, name]);
    setCommodityInput('');
  };

  const removeCommodity = (nameToRemove) => {
    setSelectedCommodities((prev) => prev.filter((c) => c !== nameToRemove));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (selectedCommodities.length === 0) {
      setFormError('Please add at least one supported commodity.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        centreId: formData.centreId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        maxFarmers: Number(formData.maxFarmers),
        maxQuantity: formData.maxQuantity ? Number(formData.maxQuantity) : undefined,
        quantityUnit: formData.quantityUnit || 'kg',
        bookingCutoffMinutes: Number(formData.bookingCutoffMinutes) || 60,
        active: true,
        supportedCommodities: selectedCommodities,
      };
      await api.createSlot(payload);
      if (onSlotCreated) onSlotCreated();
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to create single slot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="slot-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Ad-hoc Single Slot"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="slot-modal-header">
          <div>
            <span className="eyebrow" style={{ color: '#64748b' }}>ONE-OFF EXCEPTION / EMERGENCY</span>
            <h2 className="slot-modal-title">Create Ad-hoc Single Slot</h2>
          </div>
          <button type="button" className="slot-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="slot-modal-body">
            {formError && <div className="slot-alert-error">{formError}</div>}

            <div className="slot-form-grid">
              {!centreId && (
                <div className="slot-field slot-field--full">
                  <label htmlFor="single-slot-centreId" className="slot-label">Procurement Centre *</label>
                  <select
                    id="single-slot-centreId"
                    name="centreId"
                    required
                    value={formData.centreId}
                    onChange={handleChange}
                    className="slot-input"
                  >
                    <option value="" disabled>Select centre…</option>
                    {(centres || []).map((c) => (
                      <option key={c._id} value={c._id}>{c.name} · {c.district}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="slot-field">
                <label htmlFor="single-slot-date" className="slot-label">Date *</label>
                <input
                  id="single-slot-date"
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleChange}
                  className="slot-input"
                />
              </div>

              <div className="slot-field">
                <label htmlFor="single-slot-quantityUnit" className="slot-label">Quantity Unit</label>
                <input
                  id="single-slot-quantityUnit"
                  type="text"
                  name="quantityUnit"
                  required
                  value={formData.quantityUnit}
                  onChange={handleChange}
                  className="slot-input"
                  placeholder="kg"
                />
              </div>

              <div className="slot-field">
                <label htmlFor="single-slot-startTime" className="slot-label">Start Time *</label>
                <input
                  id="single-slot-startTime"
                  type="time"
                  name="startTime"
                  required
                  value={formData.startTime}
                  onChange={handleChange}
                  className="slot-input"
                />
              </div>

              <div className="slot-field">
                <label htmlFor="single-slot-endTime" className="slot-label">End Time *</label>
                <input
                  id="single-slot-endTime"
                  type="time"
                  name="endTime"
                  required
                  value={formData.endTime}
                  onChange={handleChange}
                  className="slot-input"
                />
              </div>

              <div className="slot-field">
                <label htmlFor="single-slot-maxFarmers" className="slot-label">Total Capacity (Farmers) *</label>
                <input
                  id="single-slot-maxFarmers"
                  type="number"
                  min="1"
                  required
                  value={formData.maxFarmers}
                  onChange={handleChange}
                  className="slot-input"
                  placeholder="e.g. 20"
                />
              </div>

              <div className="slot-field">
                <label htmlFor="single-slot-maxQuantity" className="slot-label">Max Quantity / Slot (optional)</label>
                <input
                  id="single-slot-maxQuantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={formData.maxQuantity}
                  onChange={handleChange}
                  className="slot-input"
                  placeholder="e.g. 500"
                />
              </div>

              <div className="slot-field slot-field--full">
                <label htmlFor="single-slot-commodity-input" className="slot-label">
                  Supported Commodities *
                  <span className="slot-label-hint"> — type commodity &amp; click Add or press Enter</span>
                </label>
                <div className="slot-commodity-row">
                  <input
                    id="single-slot-commodity-input"
                    type="text"
                    placeholder="Enter commodity name..."
                    value={commodityInput}
                    onChange={(e) => { setCommodityInput(e.target.value); setSearchError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCommodity(); } }}
                    className="slot-input slot-commodity-input"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary slot-add-btn"
                    onClick={addCommodity}
                  >
                    Add
                  </button>
                </div>
                {searchError && <p className="slot-field-error">{searchError}</p>}
                <div className="slot-chips">
                  {selectedCommodities.map((item) => (
                    <span key={item} className="slot-chip">
                      <span className="slot-chip-name">{item}</span>
                      <button
                        type="button"
                        className="slot-chip-remove"
                        onClick={() => removeCommodity(item)}
                        aria-label={`Remove ${item}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {selectedCommodities.length === 0 && (
                    <span className="slot-chips-empty">No commodities selected yet.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="slot-modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Single Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 4. Main Schedules & Slot Management Page ────────────────────────────────
export function AdminSchedulesPage() {
  const [activeTab, setActiveTab] = useState('schedules'); // 'schedules' | 'slots'
  const [schedules, setSchedules] = useState([]);
  const [slots, setSlots] = useState([]);
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [singleSlotModalOpen, setSingleSlotModalOpen] = useState(false);
  const [inspectingSchedule, setInspectingSchedule] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);

  const { notify } = useApp();

  const loadData = async () => {
    setLoading(true);
    try {
      const [scheduleData, slotData, centreData] = await Promise.all([
        api.getAdminSchedules(),
        api.getAdminSlots(),
        api.getCentres({ status: 'active' }),
      ]);
      setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
      setSlots(Array.isArray(slotData) ? slotData : []);
      setCentres(centreData.items || centreData || []);
    } catch (error) {
      notify(errorText(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSchedule = async (sched) => {
    const nextState = !sched.active;
    try {
      await api.setScheduleStatus(sched._id, nextState);
      notify(nextState ? 'Schedule activated.' : 'Schedule deactivated (future unbooked slots paused).');
      loadData();
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  const toggleSlot = async (slot) => {
    try {
      await api.updateSlot(slot._id, { active: !slot.active });
      notify(slot.active ? 'Slot deactivated.' : 'Slot activated.');
      loadData();
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  const saveSlotEdit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      centreId: data.centreId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      maxFarmers: Number(data.maxFarmers),
      maxQuantity: data.maxQuantity ? Number(data.maxQuantity) : undefined,
      quantityUnit: data.quantityUnit || 'kg',
      active: data.active === 'true',
    };
    try {
      await api.updateSlot(editingSlot._id, payload);
      setEditingSlot(null);
      notify('Slot updated.');
      loadData();
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  return (
    <div className="dashboard-page admin-page">
      {/* Page Header */}
      <div className="page-intro split" style={{ alignItems: 'flex-start' }}>
        <div>
          <span className="eyebrow">PROCUREMENT SCHEDULES &amp; SLOTS</span>
          <h2>Procurement Schedule Management</h2>
          <p>
            Configure high-level automated schedules to generate congestion-free slots across dates and operating hours.
          </p>
        </div>

        {/* Dual Actions: Primary Automated Generator vs Secondary Ad-hoc Single Slot */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => setSingleSlotModalOpen(true)}
            style={{ fontSize: 13 }}
          >
            Ad-hoc Single Slot
          </Button>
          <Button
            onClick={() => setScheduleModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={16} /> Configure Schedule
          </Button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'schedules' ? '3px solid #16a34a' : '3px solid transparent',
            color: activeTab === 'schedules' ? '#166534' : '#64748b',
            fontWeight: activeTab === 'schedules' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CalendarRange size={16} />
          Procurement Schedules ({schedules.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('slots')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'slots' ? '3px solid #16a34a' : '3px solid transparent',
            color: activeTab === 'slots' ? '#166534' : '#64748b',
            fontWeight: activeTab === 'slots' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Layers size={16} />
          All Generated Slots ({slots.length})
        </button>
      </div>

      {/* Tab 1: Procurement Schedules (Automated Template Layer) */}
      {activeTab === 'schedules' && (
        <section className="admin-table-card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Centre</th>
                  <th>Commodities</th>
                  <th>Season Window</th>
                  <th>Days &amp; Hours</th>
                  <th>Slot Config</th>
                  <th>Generated Slots</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <b>{item.centreId?.name || 'Centre'}</b>
                      <small>{item.centreId?.district} · {item.centreId?.centreCode}</small>
                    </td>
                    <td>
                      {(item.supportedCommodities || []).map((c) => (
                        <span key={c} className="status" style={{ marginRight: 4, background: '#f0fdf4', color: '#166534' }}>
                          {c}
                        </span>
                      ))}
                    </td>
                    <td>
                      <small style={{ display: 'block', color: '#475569', fontWeight: 600 }}>
                        {new Date(item.effectiveFrom).toLocaleDateString('en-IN')} – {new Date(item.effectiveUntil).toLocaleDateString('en-IN')}
                      </small>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {item.daysOfWeek?.map((d) => DAY_LABELS.find((l) => l.day === d)?.label).join(', ')}
                      </span>
                      <small style={{ display: 'block', color: '#64748b' }}>
                        {item.openingTime} – {item.closingTime}
                      </small>
                    </td>
                    <td>
                      <b>{item.slotDurationMinutes} min</b>
                      <small>{item.maxFarmersPerSlot} farmers/slot</small>
                    </td>
                    <td>
                      <span
                        style={{
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {item.totalSlotsGenerated || 0} slots
                      </span>
                    </td>
                    <td><StatusBadge status={item.active ? 'active' : 'inactive'} /></td>
                    <td className="row-actions">
                      <button
                        className="text-button"
                        onClick={() => setInspectingSchedule(item)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={13} /> Inspect
                      </button>
                      <button
                        className="text-button"
                        onClick={() => toggleSchedule(item)}
                        style={{ color: item.active ? '#dc2626' : '#16a34a' }}
                      >
                        {item.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!schedules.length && !loading && (
              <div className="empty-state">
                <CalendarRange size={32} />
                <h3>No procurement schedules configured</h3>
                <p>Configure a recurring schedule to automatically generate regular bookable slots for centres.</p>
                <Button onClick={() => setScheduleModalOpen(true)} style={{ marginTop: 12 }}>
                  <Sparkles size={16} /> Configure First Schedule
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 2: All Generated Slots (Concrete Operating Layer) */}
      {activeTab === 'slots' && (
        <section className="admin-table-card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Centre</th>
                  <th>Date</th>
                  <th>Time Window</th>
                  <th>Capacity</th>
                  <th>Bookings</th>
                  <th>Commodities</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot._id}>
                    <td>
                      <b>{slot.centreId?.name || 'Centre'}</b>
                      <small>{slot.centreId?.district}</small>
                    </td>
                    <td><b>{new Date(slot.date).toLocaleDateString('en-IN')}</b></td>
                    <td><code>{slot.startTime} – {slot.endTime}</code></td>
                    <td>
                      {slot.remainingCapacity} / {slot.maxFarmers}
                      {slot.maxQuantity != null && <small>{slot.remainingQuantity} {slot.quantityUnit} left</small>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: slot.currentBookings > 0 ? '#16a34a' : '#64748b' }}>
                        {slot.currentBookings}
                      </span>
                    </td>
                    <td>
                      {slot.supportedCommodities?.length ? (
                        slot.supportedCommodities.map((c) => (
                          <span key={c} className="status" style={{ marginRight: 4, background: '#f0fdf4', color: '#166534' }}>
                            {c}
                          </span>
                        ))
                      ) : (
                        (slot.commodityIds || []).map((c) => (
                          <span key={c._id || c} className="status" style={{ marginRight: 4 }}>
                            {c.name || c}
                          </span>
                        ))
                      )}
                    </td>
                    <td>
                      {slot.scheduleId ? (
                        <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#475569' }}>
                          Automated
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, background: '#fffbeb', padding: '2px 6px', borderRadius: 4, color: '#b45309' }}>
                          Ad-hoc
                        </span>
                      )}
                    </td>
                    <td><StatusBadge status={slot.active ? 'active' : 'inactive'} /></td>
                    <td className="row-actions">
                      <button
                        className="text-button"
                        onClick={() =>
                          setEditingSlot({
                            ...slot,
                            centreId: slot.centreId?._id || slot.centreId,
                            date: new Date(slot.date).toISOString().slice(0, 10),
                          })
                        }
                      >
                        Edit
                      </button>
                      <button className="text-button" onClick={() => toggleSlot(slot)}>
                        {slot.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!slots.length && !loading && (
              <div className="empty-state">
                <Clock3 size={30} />
                <h3>No slots generated yet</h3>
                <p>Generate a schedule or create an ad-hoc slot to begin accepting bookings.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Primary: Create Schedule Modal */}
      <CreateScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        centres={centres}
        onScheduleCreated={loadData}
      />

      {/* Secondary: Ad-hoc Single Slot Modal */}
      <CreateSlotModal
        isOpen={singleSlotModalOpen}
        onClose={() => setSingleSlotModalOpen(false)}
        centres={centres}
        onSlotCreated={loadData}
      />

      {/* Inspect Generated Slots Modal */}
      <InspectScheduleSlotsModal
        isOpen={Boolean(inspectingSchedule)}
        onClose={() => setInspectingSchedule(null)}
        schedule={inspectingSchedule}
      />

      {/* Edit Slot Modal */}
      {editingSlot && (
        <Modal title="Edit slot capacity &amp; time" onClose={() => setEditingSlot(null)}>
          <form className="modal-form" onSubmit={saveSlotEdit}>
            <label>Procurement centre
              <select name="centreId" defaultValue={editingSlot.centreId || ''} required>
                <option value="" disabled>Select centre</option>
                {centres.map((centre) => (
                  <option key={centre._id} value={centre._id}>{centre.name} · {centre.district}</option>
                ))}
              </select>
            </label>
            <label>Date<input name="date" type="date" defaultValue={editingSlot.date || ''} required /></label>
            <label>Start time<input name="startTime" type="time" defaultValue={editingSlot.startTime || ''} required /></label>
            <label>End time<input name="endTime" type="time" defaultValue={editingSlot.endTime || ''} required /></label>
            <label>Maximum farmers<input name="maxFarmers" type="number" min="1" defaultValue={editingSlot.maxFarmers || ''} required /></label>
            <label>Maximum quantity (optional)<input name="maxQuantity" type="number" min="0.001" step="0.001" defaultValue={editingSlot.maxQuantity || ''} /></label>
            <label>Quantity unit<input name="quantityUnit" defaultValue={editingSlot.quantityUnit || 'kg'} required /></label>
            <label>Status
              <select name="active" defaultValue={String(editingSlot.active !== false)}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <div className="modal-actions full">
              <Button type="button" variant="secondary" onClick={() => setEditingSlot(null)}>Cancel</Button>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function AdminPlaceholderPage({ type }) {
  const details = {
    schedules: ['Slot management', 'Create and configure individual centre slots through the backend.'],
    settings: ['System settings', 'System-level configuration is managed through environment variables initially.'],
  };
  const [title, text] = details[type] || details.settings;
  return (
    <div className="dashboard-page admin-page">
      <div className="placeholder-page">
        <span className="icon-box blue"><Settings2 size={27} /></span>
        <span className="eyebrow">ADMIN MODULE</span>
        <h2>{title}</h2>
        <p>{text}</p>
        <Button to="/admin/dashboard">Return to dashboard</Button>
      </div>
    </div>
  );
}
