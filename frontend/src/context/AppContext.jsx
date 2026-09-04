import { createContext, useContext, useMemo, useState } from 'react';
import { translations } from '../i18n/translations';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [language, setLanguage] = useState('EN');
  const [toast, setToast] = useState(null);
  const [booking, setBooking] = useState(null);
  const notify = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  };
  const t = (key) => translations[language]?.[key] || translations.EN[key] || key;
  const value = useMemo(() => ({ language, setLanguage, toast, notify, booking, setBooking, t }), [language, toast, booking]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
