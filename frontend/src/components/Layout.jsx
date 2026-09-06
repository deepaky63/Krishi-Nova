import { Bell, CalendarCheck2, ChevronRight, ClipboardList, House, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, Wheat, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, LanguageSelector, Logo, Toast } from './UI';
import { useApp } from '../context/AppContext';

export function PublicLayout() {
  const [open, setOpen] = useState(false); const location = useLocation(); const { t, user } = useApp();
  const publicLinks = [[t('nav.home'), '/'], [t('nav.about'), '/about'], [t('nav.how'), '/how-it-works'], [t('nav.centres'), '/centres'], [t('nav.contact'), '/contact']];
  const rolePath = { farmer: '/farmer/dashboard', staff: '/staff/dashboard', admin: '/admin/dashboard' };
  return <div className="site-shell"><header className="public-header"><Logo /><button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button><nav className={open ? 'open' : ''}>{publicLinks.map(([label, to]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={location.pathname === to ? 'active' : ''}>{label}</NavLink>)}<div className="mobile-only"><LanguageSelector />{user ? <Link className="mobile-user-link" to={rolePath[user.role] || '/'} onClick={() => setOpen(false)}>{user.name}</Link> : <Link className="mobile-user-link" to="/login" onClick={() => setOpen(false)}>{t('nav.login')}</Link>}</div></nav><div className="desktop-actions"><LanguageSelector />{user ? <Link className="header-user" to={rolePath[user.role] || '/'}><b>{user.name}</b><small>{user.role}</small></Link> : <Button to="/login">{t('nav.login')}</Button>}</div></header><main><Outlet /></main><Footer /><Toast /></div>;
}

export function Footer() { return <footer className="footer"><div><Logo /><p>A transparent, efficient procurement journey for farmers and centre teams.</p></div><div><b>Quick links</b><Link to="/how-it-works">How it works</Link><Link to="/centres">Find a centre</Link><Link to="/login">Farmer login</Link></div><div><b>Help & support</b><a href="tel:18001234567">1800-123-4567</a><span>Mon–Sat, 9 AM–6 PM</span></div><small>© 2026 Krishi Nova</small></footer>; }

const roleConfig = {
  farmer: { title: 'Farmer Portal', icon: Wheat, links: [['Dashboard', '/farmer/dashboard', LayoutDashboard], ['Book smart slot', '/farmer/book-slot', CalendarCheck2], ['My booking', '/farmer/booking', ClipboardList], ['Live queue', '/farmer/queue', Users], ['Procurement status', '/farmer/procurement', ShieldCheck], ['Payment status', '/farmer/payment', ClipboardList], ['Notifications', '/farmer/notifications', Bell]] },
  staff: { title: 'Centre Operations', icon: Users, links: [['Dashboard', '/staff/dashboard', LayoutDashboard], ['Live queue', '/staff/queue', Users], ['Bookings', '/staff/bookings', CalendarCheck2]] },
  admin: { title: 'Administration', icon: ShieldCheck, links: [['Dashboard', '/admin/dashboard', LayoutDashboard], ['Centre management', '/admin/centres', House], ['Schedules', '/admin/schedules', CalendarCheck2], ['Analytics', '/admin/analytics', ClipboardList], ['Staff', '/admin/staff', Users], ['Settings', '/admin/settings', Settings]] },
};

export function DashboardLayout({ role }) {
  const config = roleConfig[role]; const [open, setOpen] = useState(false); const navigate = useNavigate(); const location = useLocation(); const { user, logout } = useApp(); const Icon = config.icon;
  const signOut = async () => { await logout(); navigate('/login'); };
  return <div className={`dashboard-shell ${role}`}><aside className={open ? 'open' : ''}><div className="side-brand"><Logo /><button onClick={() => setOpen(false)} aria-label="Close menu"><X size={19} /></button></div><p className="portal-label"><Icon size={15} /> {config.title}</p><nav>{config.links.map(([name, to, LinkIcon]) => <NavLink key={to} to={to} className={location.pathname === to ? 'active' : ''} onClick={() => setOpen(false)}><LinkIcon size={18} />{name}</NavLink>)}</nav><div className="side-bottom"><Link to="/"> <House size={17} /> Public website</Link><button onClick={signOut}><LogOut size={17} /> Log out</button></div></aside><section className="dashboard-content"><header className="dashboard-header"><button className="dashboard-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button><div><span className="crumb">{config.title}</span><h1>{config.links.find(([, to]) => to === location.pathname)?.[0] || config.title}</h1></div><div className="dashboard-user"><button aria-label="Notifications"><Bell size={19} /><i></i></button><span className="avatar">{user?.name?.slice(0, 2).toUpperCase() || 'KN'}</span><div><b>{user?.name || 'Account'}</b><small>{user?.role || role}</small></div></div></header><Outlet /></section><Toast /></div>;
}
