import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations';
import { api, clearAccessToken } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [language, setLanguage] = useState('EN');
  const [toast, setToast] = useState(null);
  const [booking, setBooking] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const notify = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  };
  const t = (key) => translations[language]?.[key] || translations.EN[key] || key;
  useEffect(() => { api.refreshSession().then((result) => setUser(result.user)).catch(() => clearAccessToken()).finally(() => setAuthLoading(false)); }, []);
  const logout = async (allDevices = false) => { await api.logout(allDevices); setUser(null); setBooking(null); };
  const value = useMemo(() => ({ language, setLanguage, toast, notify, booking, setBooking, user, setUser, authLoading, logout, t }), [language, toast, booking, user, authLoading]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
