import { BarChart3, Building2, Clock3, Gauge, Settings2, UsersRound, X } from 'lucide-react';
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

// ─── Create Slot Modal ────────────────────────────────────────────────────────
// Commodity selection: typed name → strict match against existing MongoDB
// Commodity documents → sends ObjectId(s) as commodityIds.
// No free-text creation, no hardcoded names, no recommendations.
function CreateSlotModal({ isOpen, onClose, centreId, centres, onSlotCreated }) {
  const [availableCommodities, setAvailableCommodities] = useState([]);
  const [selectedCommodities, setSelectedCommodities] = useState([]);
  const [commodityInput, setCommodityInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Field names match the backend slotSchema exactly:
  // maxFarmers (int, required), maxQuantity (number, optional), quantityUnit, date, startTime, endTime
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

  // Load existing MongoDB Commodity documents when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    api.getCommodities()
      .then((list) => { if (alive) setAvailableCommodities(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setSearchError('Failed to load commodities from server.'); });
    return () => { alive = false; };
  }, [isOpen]);

  // Reset state when modal closes
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

  const addMatchedCommodity = () => {
    const query = commodityInput.trim().toLowerCase();
    if (!query) return;
    setSearchError('');
    // Strict match against existing MongoDB Commodity documents — no free-text creation
    const match = availableCommodities.find(
      (c) => c.name.trim().toLowerCase() === query || (c.code && c.code.trim().toLowerCase() === query)
    );
    if (!match) {
      setSearchError(`"${commodityInput.trim()}" was not found. Only registered commodities can be selected.`);
      return;
    }
    if (selectedCommodities.some((c) => c._id === match._id)) {
      setSearchError(`"${match.name}" is already added.`);
      return;
    }
    setSelectedCommodities((prev) => [...prev, match]);
    setCommodityInput('');
  };

  const handleCommodityKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addMatchedCommodity(); }
  };

  const removeCommodity = (id) => setSelectedCommodities((prev) => prev.filter((c) => c._id !== id));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (selectedCommodities.length === 0) {
      setFormError('Please select at least one registered commodity.');
      return;
    }
    setSubmitting(true);
    try {
      // Send MongoDB ObjectIds as commodityIds — no free-text commodity records created
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
        commodityIds: selectedCommodities.map((c) => c._id),
      };
      await api.createSlot(payload);
      if (onSlotCreated) onSlotCreated();
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to create slot.');
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
        aria-label="Create Procurement Slot"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="slot-modal-header">
          <h2 className="slot-modal-title">Create Procurement Slot</h2>
          <button type="button" className="slot-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body + form */}
        <form onSubmit={handleSubmit}>
          <div className="slot-modal-body">
            {formError && <div className="slot-alert-error">{formError}</div>}

            <div className="slot-form-grid">
              {/* Centre selector (only shown when centreId is not pre-set) */}
              {!centreId && (
                <div className="slot-field slot-field--full">
                  <label htmlFor="slot-centreId" className="slot-label">Procurement Centre</label>
                  <select
                    id="slot-centreId"
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

              {/* Date */}
              <div className="slot-field">
                <label htmlFor="slot-date" className="slot-label">Date</label>
                <input
                  id="slot-date"
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleChange}
                  className="slot-input"
                />
              </div>

              {/* Quantity Unit */}
              <div className="slot-field">
                <label htmlFor="slot-quantityUnit" className="slot-label">Quantity Unit</label>
                <input
                  id="slot-quantityUnit"
                  type="text"
                  name="quantityUnit"
                  required
                  value={formData.quantityUnit}
                  onChange={handleChange}
                  className="slot-input"
                  placeholder="kg"
                />
              </div>

              {/* Start Time */}
              <div className="slot-field">
                <label htmlFor="slot-startTime" className="slot-label">Start Time</label>
                <input
                  id="slot-startTime"
                  type="time"
                  name="startTime"
                  required
                  value={formData.startTime}
                  onChange={handleChange}
                  className="slot-input"
                />
              </div>

              {/* End Time */}
              <div className="slot-field">
                <label htmlFor="slot-endTime" className="slot-label">End Time</label>
                <input
                  id="slot-endTime"
                  type="time"
                  name="endTime"
                  required
                  value={formData.endTime}
                  onChange={handleChange}
                  className="slot-input"
                />
              </div>

              {/* Max Farmers (capacity) */}
              <div className="slot-field">
                <label htmlFor="slot-maxFarmers" className="slot-label">Total Capacity (Farmers)</label>
                <input
                  id="slot-maxFarmers"
                  type="number"
                  name="maxFarmers"
                  min="1"
                  required
                  value={formData.maxFarmers}
                  onChange={handleChange}
                  className="slot-input"
                  placeholder="e.g. 50"
                />
              </div>

              {/* Max Quantity per slot */}
              <div className="slot-field">
                <label htmlFor="slot-maxQuantity" className="slot-label">Max Quantity / Slot (optional)</label>
                <input
                  id="slot-maxQuantity"
                  type="number"
                  name="maxQuantity"
                  min="0.001"
                  step="0.001"
                  value={formData.maxQuantity}
                  onChange={handleChange}
                  className="slot-input"
                  placeholder="e.g. 500"
                />
              </div>

              {/* Booking Cutoff */}
              <div className="slot-field">
                <label htmlFor="slot-cutoff" className="slot-label">Booking Cutoff (minutes)</label>
                <input
                  id="slot-cutoff"
                  type="number"
                  name="bookingCutoffMinutes"
                  min="0"
                  value={formData.bookingCutoffMinutes}
                  onChange={handleChange}
                  className="slot-input"
                  placeholder="60"
                />
              </div>

              {/* Supported Commodities — full width */}
              <div className="slot-field slot-field--full">
                <label htmlFor="slot-commodity-input" className="slot-label">
                  Supported Commodities
                  <span className="slot-label-hint"> — type a name &amp; press Enter to select</span>
                </label>
                <div className="slot-commodity-row">
                  <input
                    id="slot-commodity-input"
                    type="text"
                    placeholder="e.g. Wheat, Paddy, Maize…"
                    value={commodityInput}
                    onChange={(e) => { setCommodityInput(e.target.value); setSearchError(''); }}
                    onKeyDown={handleCommodityKeyDown}
                    className="slot-input slot-commodity-input"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary slot-add-btn"
                    onClick={addMatchedCommodity}
                  >
                    Add
                  </button>
                </div>

                {searchError && <p className="slot-field-error">{searchError}</p>}

                {/* Selected commodity chips */}
                <div className="slot-chips">
                  {selectedCommodities.map((item) => (
                    <span key={item._id} className="slot-chip">
                      <span className="slot-chip-name">{item.name}</span>
                      {item.code && <span className="slot-chip-code">({item.code})</span>}
                      <button
                        type="button"
                        className="slot-chip-remove"
                        onClick={() => removeCommodity(item._id)}
                        aria-label={`Remove ${item.name}`}
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

          {/* Footer */}
          <div className="slot-modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminSchedulesPage() {
  const [slots, setSlots] = useState([]);
  const [centres, setCentres] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { notify } = useApp();

  const load = async () => {
    try {
      const [slotData, centreData] = await Promise.all([
        api.getAdminSlots(),
        api.getCentres({ status: 'active' }),
      ]);
      setSlots(slotData);
      setCentres(centreData.items || centreData);
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (slot) => {
    try {
      await api.updateSlot(slot._id, { active: !slot.active });
      await load();
      notify(slot.active ? 'Slot deactivated.' : 'Slot activated.');
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  // Edit slot via the original simple modal (no commodity re-selection needed for edits)
  const saveEdit = async (event) => {
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
      await api.updateSlot(editing._id, payload);
      setEditing(null);
      await load();
      notify('Slot updated.');
    } catch (error) {
      notify(errorText(error), 'error');
    }
  };

  const openEdit = (slot) => setEditing({
    ...slot,
    centreId: slot.centreId?._id || slot.centreId,
    commodityIds: (slot.commodityIds || []).map((item) => item._id || item),
    date: new Date(slot.date).toISOString().slice(0, 10),
  });

  return (
    <div className="dashboard-page admin-page">
      <div className="page-intro split">
        <div>
          <span className="eyebrow">SCHEDULES</span>
          <h2>Slot management</h2>
          <p>Create and configure individual procurement centre slots.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create slot</Button>
      </div>

      <section className="admin-table-card">
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Centre</th>
                <th>Date</th>
                <th>Time</th>
                <th>Capacity</th>
                <th>Bookings</th>
                <th>Commodities</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot._id}>
                  <td><b>{slot.centreId?.name || 'Centre'}</b><small>{slot.centreId?.district}</small></td>
                  <td>{new Date(slot.date).toLocaleDateString('en-IN')}</td>
                  <td>{slot.startTime} – {slot.endTime}</td>
                  <td>
                    {slot.remainingCapacity} / {slot.maxFarmers}
                    {slot.maxQuantity != null && <small>{slot.remainingQuantity} {slot.quantityUnit} remaining</small>}
                  </td>
                  <td>{slot.currentBookings}</td>
                  <td>
                    {(slot.commodityIds || []).map((c) => (
                      <span key={c._id || c} className="status" style={{ marginRight: 4 }}>
                        {c.name || c}
                      </span>
                    ))}
                  </td>
                  <td><StatusBadge status={slot.active ? 'active' : 'inactive'} /></td>
                  <td className="row-actions">
                    <button className="text-button" onClick={() => openEdit(slot)}>Edit</button>
                    <button className="text-button" onClick={() => toggle(slot)}>{slot.active ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!slots.length && (
            <div className="empty-state">
              <Clock3 size={30} />
              <h3>No slots configured</h3>
              <p>Create an active slot for a procurement centre to make availability visible to farmers.</p>
            </div>
          )}
        </div>
      </section>

      {/* Create Slot — new commodity-search modal */}
      <CreateSlotModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        centres={centres}
        onSlotCreated={load}
      />

      {/* Edit Slot — simple modal (commodities pre-assigned; admin can update times/capacity) */}
      {editing && (
        <Modal title="Edit slot" onClose={() => setEditing(null)}>
          <form className="modal-form" onSubmit={saveEdit}>
            <label>Procurement centre
              <select name="centreId" defaultValue={editing.centreId || ''} required>
                <option value="" disabled>Select centre</option>
                {centres.map((centre) => (
                  <option key={centre._id} value={centre._id}>{centre.name} · {centre.district}</option>
                ))}
              </select>
            </label>
            <label>Date<input name="date" type="date" defaultValue={editing.date || ''} required /></label>
            <label>Start time<input name="startTime" type="time" defaultValue={editing.startTime || ''} required /></label>
            <label>End time<input name="endTime" type="time" defaultValue={editing.endTime || ''} required /></label>
            <label>Maximum farmers<input name="maxFarmers" type="number" min="1" defaultValue={editing.maxFarmers || ''} required /></label>
            <label>Maximum quantity (optional)<input name="maxQuantity" type="number" min="0.001" step="0.001" defaultValue={editing.maxQuantity || ''} /></label>
            <label>Quantity unit<input name="quantityUnit" defaultValue={editing.quantityUnit || 'kg'} required /></label>
            <label>Status
              <select name="active" defaultValue={String(editing.active !== false)}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <div className="modal-actions full">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
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
