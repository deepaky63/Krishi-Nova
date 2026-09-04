import { Check, ChevronRight, CircleAlert, Globe2, LoaderCircle, MapPin, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export function Button({ children, to, variant = 'primary', className = '', type = 'button', ...props }) {
  const classes = `btn btn-${variant} ${className}`;
  return to ? <Link className={classes} to={to} {...props}>{children}<ChevronRight size={17} /></Link> : <button type={type} className={classes} {...props}>{children}</button>;
}

export function Logo() {
  return <Link to="/" className="brand" aria-label="Krishi Nova home"><span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span><strong>KRISHI <em>NOVA</em></strong><small>Smart Procurement. Stronger Farmers.</small></span></Link>;
}

export function SectionTitle({ eyebrow, title, text, align = '' }) {
  return <div className={`section-title ${align}`}>
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{text && <p>{text}</p>}
  </div>;
}

export function StatusBadge({ status }) {
  const kind = String(status).toLowerCase().replace(/\s/g, '-');
  return <span className={`status status-${kind}`}><i></i>{status}</span>;
}

export function StatCard({ icon: Icon, value, label, note, accent = 'green' }) {
  return <article className={`stat-card ${accent}`}><span className="stat-icon">{Icon && <Icon size={22} />}</span><div><strong>{value}</strong><b>{label}</b>{note && <small>{note}</small>}</div></article>;
}

export function CentreCard({ centre, onSelect }) {
  return <article className="centre-card"><div className="centre-card-head"><span className="icon-box green"><MapPin size={20} /></span><div><h3>{centre.name}</h3><p>{centre.location}</p></div><StatusBadge status={centre.status} /></div><div className="centre-metrics"><div><small>Distance</small><b>{centre.distance}</b></div><div><small>Current queue</small><b>{centre.queue} farmers</b></div><div><small>Capacity</small><b>{centre.capacity}%</b></div></div><div className="capacity-line"><span style={{ width: `${centre.capacity}%` }}></span></div><div className="centre-card-foot"><span>{centre.slots} slots available</span><Button variant="outline" onClick={() => onSelect?.(centre)}>View Centre</Button></div></article>;
}

export function SlotCard({ slot, selected, onSelect }) {
  return <button className={`slot-card ${slot.recommended ? 'recommended' : ''} ${selected ? 'selected' : ''}`} onClick={() => onSelect(slot)}>
    {slot.recommended && <span className="recommend-label">★ ML Recommendation (Demo)</span>}
    <span className="slot-time">{slot.time}</span><span>Queue: <b>{slot.queue}</b></span><span>Expected wait: <b>{slot.wait}</b></span><span>Centre capacity: <b>{slot.capacity}</b></span>
    <span className="slot-radio">{selected && <Check size={15} />}</span>
  </button>;
}

export function Timeline({ items, current }) {
  return <ol className="timeline">{items.map((item, index) => { const active = item.status === 'done' || item.title === current; return <li key={item.title} className={active ? 'done' : ''}><span>{item.status === 'done' ? <Check size={15} /> : index + 1}</span><div><b>{item.title}</b><p>{item.description}</p>{item.time && <small>{item.time}</small>}</div></li>; })}</ol>;
}

export function EmptyState({ title = 'Nothing here yet', text = 'There is no information to show right now.' }) { return <div className="empty-state"><CircleAlert size={30} /><h3>{title}</h3><p>{text}</p></div>; }
export function LoadingSpinner() { return <div className="loading"><LoaderCircle size={24} /> Loading information…</div>; }

export function Toast() { const { toast } = useApp(); return toast ? <div className={`toast ${toast.type}`}><Check size={18} />{toast.message}<X size={15} /></div> : null; }

export function LanguageSelector() { const { language, setLanguage } = useApp(); return <div className="language" aria-label="Choose language"><Globe2 size={16} /><button className={language === 'EN' ? 'active' : ''} onClick={() => setLanguage('EN')}>EN</button><span>|</span><button className={language === 'HI' ? 'active' : ''} onClick={() => setLanguage('HI')}>हिंदी</button></div>; }

export function Modal({ title, onClose, children }) { return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header><h2>{title}</h2><button onClick={onClose} aria-label="Close dialog"><X /></button></header>{children}</section></div>; }
