import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
// ... existing imports in AdminPages.jsx

export function CreateSlotModal({ isOpen, onClose, centreId, onSlotCreated }) {
  const [availableCommodities, setAvailableCommodities] = useState([]);
  const [selectedCommodities, setSelectedCommodities] = useState([]);
  const [commodityInput, setCommodityInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    capacity: '',
    maxQuantityPerFarmer: '',
    notes: ''
  });

  // Load existing commodities strictly from MongoDB
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadCommodities() {
      try {
        const response = await api.getCommodities();
        const list = response?.data || response || [];
        if (isMounted) {
          setAvailableCommodities(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (isMounted) {
          setSearchError('Failed to load existing commodities from server.');
        }
      }
    }

    loadCommodities();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Enter key for manual typing & strict matching
  const handleCommodityKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMatchedCommodity();
    }
  };

  const addMatchedCommodity = () => {
    const query = commodityInput.trim().toLowerCase();
    if (!query) return;

    setSearchError('');

    // Strict match against existing MongoDB Commodity documents
    const match = availableCommodities.find(
      (c) =>
        c.name.trim().toLowerCase() === query ||
        (c.code && c.code.trim().toLowerCase() === query)
    );

    if (!match) {
      setSearchError(`"${commodityInput.trim()}" does not exist. Only registered MongoDB commodities can be selected.`);
      return;
    }

    // Check if already selected
    if (selectedCommodities.some((c) => c._id === match._id)) {
      setSearchError(`"${match.name}" has already been added.`);
      return;
    }

    setSelectedCommodities([...selectedCommodities, match]);
    setCommodityInput('');
  };

  const removeCommodity = (id) => {
    setSelectedCommodities(selectedCommodities.filter((c) => c._id !== id));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      // Send MongoDB ObjectIds strictly as commodityIds
      const payload = {
        ...formData,
        centreId,
        capacity: Number(formData.capacity),
        maxQuantityPerFarmer: Number(formData.maxQuantityPerFarmer),
        commodityIds: selectedCommodities.map((c) => c._id)
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
    <div className="modal-backdrop">
      <div className="slot-modal-container" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">Create Procurement Slot</h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="slot-modal-form">
          <div className="slot-modal-scrollable-body">
            {formError && <div className="alert alert-danger">{formError}</div>}

            <div className="slot-responsive-grid">
              {/* Date */}
              <div className="form-group">
                <label htmlFor="slot-date" className="form-label">Date</label>
                <input
                  id="slot-date"
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>

              {/* Start Time */}
              <div className="form-group">
                <label htmlFor="slot-startTime" className="form-label">Start Time</label>
                <input
                  id="slot-startTime"
                  type="time"
                  name="startTime"
                  required
                  value={formData.startTime}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>

              {/* End Time */}
              <div className="form-group">
                <label htmlFor="slot-endTime" className="form-label">End Time</label>
                <input
                  id="slot-endTime"
                  type="time"
                  name="endTime"
                  required
                  value={formData.endTime}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>

              {/* Capacity */}
              <div className="form-group">
                <label htmlFor="slot-capacity" className="form-label">Total Capacity (Slots)</label>
                <input
                  id="slot-capacity"
                  type="number"
                  name="capacity"
                  min="1"
                  required
                  value={formData.capacity}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>

              {/* Maximum Quantity Per Farmer */}
              <div className="form-group">
                <label htmlFor="slot-maxQty" className="form-label">
                  Max Quantity / Farmer (Quintals)
                </label>
                <input
                  id="slot-maxQty"
                  type="number"
                  name="maxQuantityPerFarmer"
                  min="0.1"
                  step="0.1"
                  required
                  value={formData.maxQuantityPerFarmer}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>

              {/* Supported Commodities Entry (Full Width across columns) */}
              <div className="form-group span-full">
                <label htmlFor="commodity-search-input" className="form-label">
                  Supported Commodities (Press Enter to match & select)
                </label>
                <div className="commodity-input-wrapper">
                  <input
                    id="commodity-search-input"
                    type="text"
                    placeholder="Type registered commodity name and press Enter..."
                    value={commodityInput}
                    onChange={(e) => {
                      setCommodityInput(e.target.value);
                      setSearchError('');
                    }}
                    onKeyDown={handleCommodityKeyDown}
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addMatchedCommodity}
                  >
                    Add
                  </button>
                </div>

                {searchError && (
                  <p className="field-error-text">{searchError}</p>
                )}

                {/* Selected MongoDB Commodities Chips */}
                <div className="selected-commodities-chip-list">
                  {selectedCommodities.map((item) => (
                    <span key={item._id} className="commodity-badge-chip">
                      <span className="chip-name">{item.name}</span>
                      {item.code && <span className="chip-code">({item.code})</span>}
                      <button
                        type="button"
                        className="chip-remove-btn"
                        onClick={() => removeCommodity(item._id)}
                        aria-label={`Remove ${item.name}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {selectedCommodities.length === 0 && (
                    <span className="empty-selection-placeholder">
                      No commodities selected. Type an existing commodity above.
                    </span>
                  )}
                </div>
              </div>

              {/* Notes (Full width) */}
              <div className="form-group span-full">
                <label htmlFor="slot-notes" className="form-label">Notes (Optional)</label>
                <textarea
                  id="slot-notes"
                  name="notes"
                  rows="2"
                  value={formData.notes}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
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
              {submitting ? 'Creating Slot...' : 'Create Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
