import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
 onAuthStateChanged, 
 signInWithPopup, 
 signInAnonymously, 
 signOut, 
 User 
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { useLedger } from './hooks/useLedger';
import Dashboard from './components/Dashboard';
import CustomerManager from './components/CustomerManager';
import RemindersManager from './components/RemindersManager';
import SettingsManager from './components/SettingsManager';
import QuickEntryModal from './components/QuickEntryModal';
import AnalyticsManager from './components/AnalyticsManager';
import { ExportMergedButton } from './components/ExportMergedButton';
import TagBadge from './components/TagBadge';
import AdminPanelModal from './components/AdminPanelModal';
import { checkIsAdmin } from './lib/adminAuth';
import { exportDailyTransactionsToCSV, exportDailyTransactionsToPDF } from './lib/exportUtils';
import {
  LayoutDashboard, Users, Bell, Settings, BookOpen, Clock, Globe, Plus, Moon, Sun, ArrowUpRight, ArrowDownLeft, ChevronRight, BarChart3, ArrowLeft, ClipboardList, Lock, Loader2, Calendar, CheckCircle2, CloudOff, Database, BatteryWarning
} from 'lucide-react';
import { showNotification } from './lib/notifications';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { triggerHaptic } from './lib/haptics';
import { translations, Language, formatNumber } from './lib/translations';

const parseFirestoreDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'home' | 'customers' | 'analytics' | 'reminders' | 'settings' | 'daily_transactions'>('home');
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [selectedCustomerIdForDetail, setSelectedCustomerIdForDetail] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [swipeGesturesEnabled, setSwipeGesturesEnabled] = useState(() => localStorage.getItem('swipe_gestures_enabled') !== 'false');
  const [highlightedTxId, setHighlightedTxId] = useState<string | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Administrative authority check
  const isAdmin = useMemo(() => checkIsAdmin(user), [user]);

  const isQuickEntryOpenRef = useRef(isQuickEntryOpen);
  useEffect(() => {
    isQuickEntryOpenRef.current = isQuickEntryOpen;
  }, [isQuickEntryOpen]);

  // Reset scroll height to top on tab or selected customer changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentTab, selectedCustomerIdForDetail]);

 useEffect(() => {
   const handleBeforeInstallPrompt = (e: any) => {
     e.preventDefault();
     setDeferredPrompt(e);
   };
   window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
   return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
 }, []);

 // History API / Breadcrumbs for Android Back Button support
 const navigateTo = (tab: typeof currentTab, customerId: string | null = null, replace = false) => {
 triggerHaptic('single');
 setCurrentTab(tab);
 setSelectedCustomerIdForDetail(customerId);
 const state = { tab, customerId, quickEntry: false };
 const url = `?tab=${tab}${customerId ? `&c=${customerId}` : ''}`;
 if (replace) {
 window.history.replaceState(state, '', url);
 } else {
 window.history.pushState(state, '', url);
 }
 };

 const openQuickEntry = () => {
 triggerHaptic('single');
 window.history.pushState({ ...window.history.state, quickEntry: true }, '', window.location.href);
 setIsQuickEntryOpen(true);
 };

  const closeQuickEntry = () => {
    if (!window.history.state?.quickEntry) {
      triggerHaptic('tick');
      setIsQuickEntryOpen(false);
    } else {
      window.history.back();
    }
  };

  useEffect(() => {
    // Force open dashboard on fresh load regardless of previous URL
    setCurrentTab('home');
    setSelectedCustomerIdForDetail(null);
    setIsQuickEntryOpen(false);
    
    window.history.replaceState({ tab: 'home', customerId: null, quickEntry: false }, '', window.location.pathname + '?tab=home');

    const handlePopState = (e: PopStateEvent) => {
      setAppDialog(null);
      const wasQuickEntryOpen = isQuickEntryOpenRef.current;
      const isNowQuickEntryOpen = e.state?.quickEntry || false;
      if (wasQuickEntryOpen && !isNowQuickEntryOpen) {
        triggerHaptic('tick');
      }
      if (e.state) {
        setCurrentTab(e.state.tab || 'home');
        setSelectedCustomerIdForDetail(e.state.customerId || null);
        setIsQuickEntryOpen(isNowQuickEntryOpen);
      } else {
        setIsQuickEntryOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Cleanup any old senior mode remnants on mount + listen for open-daily-transactions
  useEffect(() => {
    document.documentElement.classList.remove('senior-mode');
    localStorage.removeItem('senior_mode');

    const handleOpenDailyTxs = () => {
      navigateTo('daily_transactions');
    };
    window.addEventListener('open-daily-transactions', handleOpenDailyTxs);
    return () => {
      window.removeEventListener('open-daily-transactions', handleOpenDailyTxs);
    };
  }, []);
 // Multilingual State ('bn' is Bangla, 'en' is English)
 const [lang, setLang] = useState<Language>(() => {
 return (localStorage.getItem('lang') as Language) || 'bn';
 });

 const handleLangChange = (newLang: Language) => {
 setLang(newLang);
 localStorage.setItem('lang', newLang);
 };

 const t = translations[lang];



 // State for Theme
 const [theme, setTheme] = useState<'light' | 'dark'>(() => {
 return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
 });

 // Apply theme class to document element dynamically
 useEffect(() => {
 const root = document.documentElement;
 if (theme === 'dark') {
 root.classList.add('dark');
 } else {
 root.classList.remove('dark');
 }
 localStorage.setItem('theme', theme);
 }, [theme]);

 const [authError, setAuthError] = useState<string | null>(null);

 // Sync Auth State
 useEffect(() => {
 const isGuest = localStorage.getItem('local_guest_session') === 'true';
 if (isGuest) {
 setUser({
 uid: 'local-guest-session',
 email: 'guest@takatrek.local',
 displayName: 'Guest Owner'
 } as any);
 setAuthLoading(false);
 }

 const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
 if (currentUser) {
 setUser(currentUser);
 localStorage.removeItem('local_guest_session');
 } else {
 if (localStorage.getItem('local_guest_session') !== 'true') {
 setUser(null);
 }
 }
 setAuthLoading(false);
 });
 return () => unsubscribe();
 }, []);

  const [selectedDailyDate, setSelectedDailyDate] = useState<Date>(new Date());

 // Hook for full database state & synced offline storage
 const {
 customers,
 transactions,
 dailyTransactions,
 reminders,
 settings,
 loading: ledgerLoading,
 isOfflineFallback,
 syncStatus,
 updateTheme,
 updateSettings,
    updateDailyTarget,
 createCustomer,
 updateCustomerDetails,
 addTransaction,
 editTransaction,
 deleteTransaction,
    restoreTransaction,
    addReminder,
 toggleReminder,
 deleteReminder,
 deleteCustomer,
 trashCustomers,
 restoreCustomer,
 permanentlyDeleteCustomer,
 emptyTrash,
 importLedgerData,
 hasMoreTxs,
 loadMoreTransactions
 } = useLedger(user?.uid, selectedDailyDate);

  const dateInputRef = useRef<HTMLInputElement>(null);

  const todayTransactions = dailyTransactions;

  // Sync status feedback (Desktop Visual Tooltip & Mobile Vibration)
  const prevSyncStatusRef = useRef(syncStatus);
  const [showSyncTooltip, setShowSyncTooltip] = useState(false);
  const [isHoveredSync, setIsHoveredSync] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date | null>(null);
  const syncTooltipTimerRef = useRef<any>(null);

  useEffect(() => {
    // When sync status toggles from 'syncing' to 'saved'
    if (prevSyncStatusRef.current === 'syncing' && syncStatus === 'saved') {
      setLastSyncedTime(new Date());

      // 1. Subtle vibration feedback on mobile
      if (typeof window !== 'undefined' && 'navigator' in window && typeof window.navigator.vibrate === 'function') {
        try {
          window.navigator.vibrate(30);
        } catch (e) {
          // Silently ignore if device/browser restricts vibration
        }
      }
      try {
        triggerHaptic('tick');
      } catch (e) {}

      // 2. Visual tooltip auto-reveal feedback on desktop
      setShowSyncTooltip(true);
      if (syncTooltipTimerRef.current) clearTimeout(syncTooltipTimerRef.current);
      syncTooltipTimerRef.current = setTimeout(() => {
        setShowSyncTooltip(false);
      }, 2800);
    }

    prevSyncStatusRef.current = syncStatus;

    return () => {
      if (syncTooltipTimerRef.current) clearTimeout(syncTooltipTimerRef.current);
    };
  }, [syncStatus]);

  // Battery status tracking (detect critically low battery causing background sync throttling)
  const [batteryState, setBatteryState] = useState<{
    level: number;
    charging: boolean;
    isCriticallyLow: boolean;
  }>({
    level: 1,
    charging: true,
    isCriticallyLow: false
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'navigator' in window && 'getBattery' in (navigator as any)) {
      let batteryRef: any = null;
      const updateBattery = (b: any) => {
        const level = typeof b.level === 'number' ? b.level : 1;
        const charging = !!b.charging;
        // OS battery saver / background sync throttling typically engages at <= 20% when not plugged into power
        const isCriticallyLow = level <= 0.20 && !charging;
        setBatteryState({
          level,
          charging,
          isCriticallyLow
        });
      };

      (navigator as any).getBattery().then((b: any) => {
        batteryRef = b;
        updateBattery(b);
        b.addEventListener?.('levelchange', () => updateBattery(b));
        b.addEventListener?.('chargingchange', () => updateBattery(b));
      }).catch(() => {
        // Battery status API disabled or unavailable
      });

      return () => {
        if (batteryRef) {
          batteryRef.removeEventListener?.('levelchange', () => updateBattery(batteryRef));
          batteryRef.removeEventListener?.('chargingchange', () => updateBattery(batteryRef));
        }
      };
    }
  }, []);

 // End-of-Day Cash Summary Notification
 useEffect(() => {
 if (!user || !transactions || transactions.length === 0) return;

 if ('Notification' in window && window.Notification && window.Notification.permission === 'default') {
 window.Notification.requestPermission();
 }

 const checkAndNotify = () => {
 const now = new Date();
 if (now.getHours() >= 20) { // 8 PM or later
 const todayStr = now.toDateString();
 const lastNotifiedDate = localStorage.getItem('last_cash_summary_date');
 
 if (lastNotifiedDate !== todayStr && 'Notification' in window && window.Notification && window.Notification.permission === 'granted') {
 let todaysCash = 0;
 transactions.forEach(tx => {
 const txDate = new Date(tx.date);
 if (txDate.toDateString() === todayStr && tx.type === 'payment') {
 todaysCash += tx.amount;
 }
 });
 
 if (todaysCash > 0) {
 showNotification(lang === 'bn' ? 'আজকের নগদ আদায়' : 'Daily Cash Summary', {
 body: lang === 'bn' 
 ? `আজকের মোট নগদ আদায়: ৳${formatNumber(todaysCash, 'bn')}` 
 : `Total cash collected today: ৳${formatNumber(todaysCash, 'en')}`,
 icon: '/icon-192.png'
 });
 localStorage.setItem('last_cash_summary_date', todayStr);
 }
 }
 }
 };

 checkAndNotify();
 const interval = setInterval(checkAndNotify, 60000);
 return () => clearInterval(interval);
 }, [user, transactions, lang]);

  // Sync theme with Firestore settings on initial load or cross-device change
  const [initialSettingsSynced, setInitialSettingsSynced] = useState(false);
  useEffect(() => {
    // Theme is local only now, so we do not sync theme from settings
    if (settings && !initialSettingsSynced) {
      setInitialSettingsSynced(true);
    }
  }, [settings, initialSettingsSynced]);

 // Virtual Custom Dialogue Popups to bypass sandboxed iframe alert()/confirm() blocks
 const [appDialog, setAppDialog] = useState<{
 isOpen: boolean;
 type: 'alert' | 'confirm';
 title: string;
 message: string;
 onConfirm: () => void;
 onCancel?: () => void;
 } | null>(null);

 useEffect(() => {
    if (appDialog?.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [appDialog?.isOpen]);

 const triggerAlert = (title: string, message: string) => {
 toast.error(title, { description: message });
 };

 const triggerConfirm = (title: string, message: string, onConfirmCallback: () => void) => {
 window.history.pushState({ ...window.history.state, dialogOpen: true }, '', window.location.href);
 setAppDialog({
 isOpen: true,
 type: 'confirm',
 title,
 message,
 onConfirm: () => {
 if (window.history.state?.dialogOpen) window.history.back();
 onConfirmCallback();
 setAppDialog(null);
 },
 onCancel: () => {
 if (window.history.state?.dialogOpen) window.history.back();
 setAppDialog(null);
 }
 });
 };

 const handleThemeChange = async (newTheme: 'light' | 'dark') => {
 setTheme(newTheme);
 // Persist immediately on client
 localStorage.setItem('theme', newTheme);
  if (user) {
    try {
      await updateTheme(newTheme);
    } catch (err) {
      console.error('Failed to sync theme to cloud:', err);
    }
  }
};

 // Handle Log In Mechanisms
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setAuthError(null);
    sessionStorage.setItem('login_intent_theme', theme);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Auth Failed: ', err);
      const errMsg = err?.message || String(err);
      setAuthError(errMsg);
      
      triggerAlert(
        lang === 'bn' ? 'লগইন ব্যর্থ' : 'Login Failed',
        lang === 'bn' 
          ? 'গুগল লগইন করতে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগটি চেক করুন এবং আবার চেষ্টা করুন।' 
          : 'Google sign-in could not connect. Please check your internet connection and try again.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

 const handleGuestSignIn = () => {
 sessionStorage.setItem('login_intent_theme', theme);
 localStorage.setItem('local_guest_session', 'true');
 setUser({
 uid: 'local-guest-session',
 email: 'guest@takatrek.local',
 displayName: 'Guest Owner'
 } as any);
 };

 const handleSignOut = async () => {
 triggerConfirm(
 lang === 'bn' ? 'লগ আউট নিশ্চিতকরণ' : 'Confirm Sign Out',
 t.signOutConfirm,
 async () => {
 try {
 localStorage.removeItem('local_guest_session');
 setUser(null);
 await signOut(auth);
 navigateTo('home', null, true);
 setInitialSettingsSynced(false);
 } catch (err) {
 console.error(err);
 }
 }
 );
 };

   // Nav helper
  const navigateToCustomer = (id: string, replace = false) => {
    setIsQuickEntryOpen(false);
    navigateTo('customers', id, replace);
  };

 if (authLoading) {
 return (
 <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 transition-colors">
 <Toaster theme={theme} richColors position="top-center" />
 <div className="flex flex-col items-center gap-4 text-center">
 <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500 animate-bounce">
 <BookOpen className="w-8 h-8" />
 </div>
 <div>
 <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white">{t.openingLedger}</h3>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t.applyingCloud}</p>
 </div>
 </div>
 </div>
 );
 }

 // --- 1. SIGN IN LANDING SCREEN (WITH TRANSLATIONS) ---
  if (!user) {
    return (
      <div id="auth_view" className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 no-select transition-colors relative overflow-hidden">
        {/* Elegant Ambient Background */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
        
        <Toaster 
          theme={theme} 
          richColors 
          position="top-center" 
          toastOptions={{ 
            style: { marginTop: '80px', padding: '16px', borderRadius: '16px' },
            className: 'border-2 border-zinc-200 dark:border-zinc-800 shadow-2xl font-bold bg-white dark:bg-zinc-900'
          }} 
        />
        
        {/* Safe Centered Language & Theme Toggles to guarantee no cutoff in iframes */}
        <div className="w-full max-w-md flex items-center justify-center gap-3 mb-8 relative z-10">
 {/* Theme switcher */}
 <button
 onClick={() => {
    triggerHaptic('single');
    handleThemeChange(theme === 'dark' ? 'light' : 'dark');
  }}
 className="px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-100 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center gap-2 text-xs font-bold transition-colors"
 title="Toggle theme"
 >
 {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
 {theme === 'dark' ? (lang === 'bn' ? 'লাইট মোড' : 'Light Mode') : (lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode')}
 </button>

 {/* Language selector toggle */}
 <button
 onClick={() => {
    triggerHaptic('single');
    handleLangChange(lang === 'bn' ? 'en' : 'bn');
  }}
 className="px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-extrabold text-xs text-zinc-800 dark:text-zinc-100 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
 >
 <Globe className="w-4 h-4 text-emerald-500" />
 {lang === 'bn' ? 'English' : 'বাংলা'}
 </button>
 </div>

        <div className="w-full max-w-md bg-white/70 dark:bg-zinc-900/60 backdrop-blur-2xl rounded-3xl border border-white/50 dark:border-white/5 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] space-y-8 relative z-10">
          
          {/* Logo Heading */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#009966] dark:bg-[#007d54] flex items-center justify-center text-white shadow-md">
              <BookOpen className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight">{t.appName}</h1>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-bold">{t.ledgerForTablet}</p>
 </div>
          </div>
          
          {/* Premium illustration points */}
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 rounded-xl mt-0.5 shrink-0">
                <ArrowUpRight className="w-4.5 h-4.5 stroke-[2]" />
              </div>
 <div>
 <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">{t.trackAndDeduct}</h4>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{t.trackDesc}</p>
 </div>
 </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 rounded-xl mt-0.5 shrink-0">
                <Globe className="w-4.5 h-4.5 stroke-[2]" />
              </div>
 <div>
 <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">{t.cloudSync}</h4>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{t.cloudDesc}</p>
 </div>
 </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 rounded-xl mt-0.5 shrink-0">
                <Bell className="w-4.5 h-4.5 stroke-[2]" />
              </div>
 <div>
 <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">{t.simpleAlerts}</h4>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{t.alertsDesc}</p>
 </div>
 </div>
 </div>

          {/* Authentications Buttons */}
          <div className="space-y-3 pt-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-white font-semibold rounded-2xl flex items-center justify-center gap-3 transition-colors cursor-pointer text-sm disabled:opacity-75 disabled:cursor-not-allowed"
              id="google_signin_btn"
            >
              {googleLoading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <svg className="h-4.5 w-4.5 shrink-0 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              {googleLoading ? (lang === 'bn' ? 'লগইন হচ্ছে...' : 'Signing in...') : t.googleSignIn}
            </button>
            <button
              onClick={handleGuestSignIn}
              className="w-full py-4 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 font-semibold rounded-2xl flex items-center justify-center gap-2 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors cursor-pointer text-sm"
              id="guest_signin_btn"
            >
              {t.guestSignIn}
            </button>
          </div>

  {authError && (
 <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-bold space-y-2 leading-normal">
 <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-black">
 <span className="w-2 h-2 rounded-full bg-amber-500"></span>
 {lang === 'bn' ? 'লগইন সাহায্য নির্দেশিকা' : 'Google Login Troubleshooting'}
 </div>
 <p className="opacity-90">
 {lang === 'bn'
 ? 'গুগল সাইন-ইন সম্পন্ন করতে আপনার ফায়ারবেস প্রজেক্টের "Authorized Domains" তালিকায় এই ডোমেনটি যুক্ত করতে হবে:'
 : 'To complete Google Sign-In, you need to add this domain to your Firebase Authorized Domains list:'}
 </p>
 <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl font-mono text-[11px] break-all select-all text-zinc-700 dark:text-zinc-400 border border-amber-200/50">
 {typeof window !== 'undefined' ? window.location.hostname : 'localhost'}
 </div>
 <p className="opacity-90 text-[11px]">
 {lang === 'bn'
 ? 'ধাপ: Firebase Console > Authentication > Settings > Authorized Domains-এ গিয়ে উপরের ডোমেনটি যুক্ত করুন। অথবা যেকোনো সময় গেস্ট মোড বাটন চেপে অ্যাপ ব্যবহার করুন।'
 : 'Steps: Go to Firebase Console > Authentication > Settings > Authorized Domains and add the domain above. Or, start immediately using Guest Mode.'}
 </p>
 </div>
 )}

 {/* Secure Sync Notice */}
  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-2xl text-[11px] text-emerald-800 dark:text-emerald-300 font-bold leading-normal flex items-start gap-2">
    <Lock className="w-4 h-4 text-orange-500 dark:text-orange-400 shrink-0 mt-0.5" />
    <span>
      {lang === 'bn' 
      ? 'গ্লোবাল অ্যাকাউন্ট ব্যাকআপ আবশ্যক: আপনার হিসাব খাতার ডেটা সুরক্ষিত রাখতে এবং ভুলবশত হিসাব নষ্ট না করতে গুগল দিয়ে নিরাপদে লগইন করুন।'
      : 'Secure Account Backup Required: Sign in with Google to protect your ledger calculations from data loss and sync automatically across all devices.'}
    </span>
  </div>

 <div className="text-[10px] text-center text-zinc-400 dark:text-zinc-500 px-4 font-bold leading-normal">
 {t.offlineNotice}
 </div>
 </div>
 </div>
 );
 }

 // --- 2. MAIN APP CONTAINER (LOGGED IN & TRANSLATED) ---
 return (
 <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 flex flex-col no-select pb-24 sm:pb-0 transition-colors">
 <Toaster theme={theme} richColors position="top-center" />
 
 {/* Dynamic Top App Header */}
 <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 py-3.5 px-4 sm:px-6 sticky top-0 z-30 shadow-md">
 <div className="max-w-6xl mx-auto flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-[#009966] flex items-center justify-center text-white shadow-md">
 <BookOpen className="w-5 h-5 stroke-[2.5]" />
 </div>
 <h1 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">{t.appName}</h1>
 </div>

 <div className="flex items-center gap-2.5">
          {/* Subtle Saved / Syncing Status Indicator with Desktop Visual Tooltip */}
          <div 
            id="sync_status_indicator"
            className="relative flex items-center cursor-pointer select-none group focus:outline-none"
            onMouseEnter={() => setIsHoveredSync(true)}
            onMouseLeave={() => setIsHoveredSync(false)}
            onFocus={() => setIsHoveredSync(true)}
            onBlur={() => setIsHoveredSync(false)}
            tabIndex={0}
            role="button"
            aria-label={
              syncStatus === 'syncing' 
                ? (lang === 'bn' ? 'ডাটা ক্লাউডে সিঙ্ক হচ্ছে' : 'Data syncing with cloud')
                : syncStatus === 'offline' 
                ? (lang === 'bn' ? 'অফলাইন মোড' : 'Offline mode') 
                : (lang === 'bn' ? 'ক্লাউডে সংরক্ষিত' : 'Saved to cloud')
            }
          >
            <motion.div
              animate={showSyncTooltip ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex items-center"
            >
              {syncStatus === 'syncing' ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span className="text-2xs sm:text-xs font-bold tracking-tight">
                    {lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...'}
                  </span>
                  {batteryState.isCriticallyLow && (
                    <BatteryWarning className="w-3.5 h-3.5 text-amber-500 ml-0.5" />
                  )}
                </div>
              ) : syncStatus === 'offline' ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  <CloudOff className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-2xs sm:text-xs font-bold tracking-tight">
                    {lang === 'bn' ? 'অফলাইন' : 'Offline'}
                  </span>
                  {batteryState.isCriticallyLow && (
                    <BatteryWarning className="w-3.5 h-3.5 text-amber-500 ml-0.5" />
                  )}
                </div>
              ) : (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                  showSyncTooltip 
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40' 
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 text-emerald-500 transition-transform ${showSyncTooltip ? 'scale-110' : ''}`} />
                  <span className="text-2xs sm:text-xs font-bold tracking-tight">
                    {lang === 'bn' ? 'সংরক্ষিত' : 'Saved'}
                  </span>
                  {batteryState.isCriticallyLow && (
                    <BatteryWarning className="w-3.5 h-3.5 text-amber-500 ml-0.5 animate-pulse" />
                  )}
                </div>
              )}
            </motion.div>

            {/* Desktop Visual Tooltip (Solid colors only, no gradients) */}
            <AnimatePresence>
              {(isHoveredSync || showSyncTooltip) && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 3, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  role="tooltip"
                  className="hidden sm:block absolute top-full mt-2.5 right-0 sm:left-1/2 sm:-translate-x-1/2 z-50 pointer-events-none"
                >
                  <div className="relative bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl p-3 shadow-2xl border border-zinc-700/80 w-64 text-left">
                    {/* Pointer arrow on top (solid color) */}
                    <div className="absolute -top-1.5 right-6 sm:left-1/2 sm:-translate-x-1/2 w-3 h-3 rotate-45 bg-zinc-900 dark:bg-zinc-800 border-t border-l border-zinc-700/80" />

                    <div className="relative z-10 flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {syncStatus === 'syncing' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        ) : syncStatus === 'offline' ? (
                          <CloudOff className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-xs font-bold text-white tracking-tight truncate">
                            {syncStatus === 'syncing'
                              ? (lang === 'bn' ? 'ডাটা ক্লাউডে সিঙ্ক হচ্ছে...' : 'Syncing Data...')
                              : syncStatus === 'offline'
                              ? (lang === 'bn' ? 'অফলাইন মোড' : 'Offline Mode')
                              : (lang === 'bn' ? 'ক্লাউডে সম্পূর্ণ সংরক্ষিত' : 'All Changes Saved')}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            syncStatus === 'syncing'
                              ? 'bg-amber-500/20 text-amber-300'
                              : syncStatus === 'offline'
                              ? 'bg-zinc-700 text-zinc-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {syncStatus === 'syncing' ? (lang === 'bn' ? 'চলছে' : 'Syncing') : syncStatus === 'offline' ? (lang === 'bn' ? 'অফলাইন' : 'Offline') : (lang === 'bn' ? 'নিরাপদ' : 'Saved')}
                          </span>
                        </div>

                        <p className="text-[11px] text-zinc-300 leading-snug">
                          {syncStatus === 'syncing'
                            ? (lang === 'bn' ? 'আপনার নতুন লেনদেন ও হিসাব ক্লাউড ডাটাবেসে সেভ হচ্ছে।' : 'Synchronizing your ledger calculations with secure cloud storage.')
                            : syncStatus === 'offline'
                            ? (lang === 'bn' ? 'ইন্টারনেট নেই। সকল তথ্য এই ডিভাইসে সুরক্ষিত আছে, ইন্টারনেট পেলে সিঙ্ক হবে।' : 'Offline. All records are stored locally and will sync when connected.')
                            : (lang === 'bn' ? 'আপনার সকল হিসাব খাতার তথ্য রিয়েলটাইমে সুরক্ষিত ও ব্যাকআপ আছে।' : 'Your ledger calculations are backed up and synced across all devices.')}
                        </p>

                        {lastSyncedTime && syncStatus === 'saved' && (
                          <div className="mt-2 pt-1.5 border-t border-zinc-700/80 flex items-center justify-between text-[10px] text-zinc-400">
                            <span>{lang === 'bn' ? 'সর্বশেষ সিঙ্ক:' : 'Last synced:'}</span>
                            <span className="font-mono text-emerald-400 font-semibold">
                              {lastSyncedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        )}

                        {/* Low Battery OS Throttling Warning */}
                        {batteryState.isCriticallyLow && (
                          <div className="mt-2.5 pt-2 border-t border-zinc-700/80">
                            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                              <BatteryWarning className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                              <div className="text-[11px] leading-snug">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-amber-300">
                                    {lang === 'bn' ? 'স্বল্প ব্যাটারি সতর্কতা' : 'Low Battery Warning'}
                                  </span>
                                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                    {Math.round(batteryState.level * 100)}%
                                  </span>
                                </div>
                                <p className="text-zinc-300 text-[10px] mt-0.5">
                                  {lang === 'bn'
                                    ? 'ডিভাইসের ব্যাটারি আশঙ্কাজনকভাবে কম থাকায় ওএস ব্যাকগ্রাউন্ড সিঙ্ক ও নেটওয়ার্ক সীমিত করতে পারে।'
                                    : 'Device battery is critically low. OS battery saver may delay or throttle background sync.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

 {/* Quick-Entry Primary Header Trigger */}
 <button
 onClick={openQuickEntry}
 className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl text-sm flex items-center gap-1.5 shadow-md shadow-emerald-50 dark:shadow-none hover:bg-emerald-700 transition-colors cursor-pointer"
 id="quick_add_header_btn"
 >
 <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
 <span className="hidden xs:inline">{t.recordEntry}</span>
 <span className="xs:hidden">{lang === 'bn' ? 'এন্ট্রি' : 'Entry'}</span>
 </button>
 </div>
 </div>
 </header>

 {/* Main Core Content Stage */}
 <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 mb-16 sm:mb-24">
 
 {/* Loading overlay for operations */}
 {ledgerLoading && (
 <div className="text-center py-10 text-zinc-400 font-bold text-sm">
 {t.updatingBackup}
 </div>
 )}

 {/* Dynamic Route/Component loading */}
 {!ledgerLoading && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
 {currentTab === 'home' && (
 <Dashboard 
 customers={customers}
 transactions={transactions}
 onOpenQuickEntry={openQuickEntry}
 onSelectCustomer={navigateToCustomer}
 lang={lang}
 onViewDailyTxs={() => navigateTo('daily_transactions')}
            dailyTarget={settings?.dailyCollectionTarget ?? 5000}
            onUpdateDailyTarget={updateDailyTarget}
          />
 )}

 {currentTab === 'customers' && (
 <CustomerManager 
 customers={customers}
 transactions={transactions}
 createCustomer={createCustomer}
 addTransaction={addTransaction}
 editTransaction={editTransaction}
 deleteTransaction={deleteTransaction}
 updateCustomerDetails={updateCustomerDetails}
 deleteCustomer={deleteCustomer}
          restoreCustomer={restoreCustomer}
          restoreTransaction={restoreTransaction}
          selectedCustomerId={selectedCustomerIdForDetail}
 setSelectedCustomerId={(id) => navigateTo('customers', id)} hasMoreTxs={hasMoreTxs} loadMoreTransactions={loadMoreTransactions}
 lang={lang}
 triggerConfirm={triggerConfirm}
 swipeGesturesEnabled={swipeGesturesEnabled}
   highlightedTxId={highlightedTxId}
  setHighlightedTxId={setHighlightedTxId}
  />
 )}

 {currentTab === 'reminders' && (
 <RemindersManager 
 reminders={reminders}
 customers={customers}
 addReminder={addReminder}
 toggleReminder={toggleReminder}
 deleteReminder={deleteReminder}
 dailyReminderTime={settings?.dailyReminderTime || '09:00'}
updateSettings={updateSettings}
 lang={lang}
 />
 )}

 {currentTab === 'settings' && (
  <SettingsManager 
         theme={theme}
         settings={settings}
         updateTheme={handleThemeChange}
         customers={customers}
         transactions={transactions}
         onSignOut={handleSignOut}
         lang={lang}
         onLangChange={handleLangChange}
         deferredPrompt={deferredPrompt}
         onInstallComplete={() => setDeferredPrompt(null)}
         trashCustomers={trashCustomers}
         restoreCustomer={restoreCustomer}
         permanentlyDeleteCustomer={permanentlyDeleteCustomer}
         emptyTrash={emptyTrash}
         swipeGesturesEnabled={swipeGesturesEnabled}
         onSwipeGesturesToggle={(val) => {
           setSwipeGesturesEnabled(val);
           localStorage.setItem('swipe_gestures_enabled', val ? 'true' : 'false');
         }}
         importLedgerData={importLedgerData}
         isAdmin={isAdmin}
         userEmail={user?.email}
         onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
       />
  )}

      {currentTab === 'daily_transactions' && (
        <div className="space-y-4 no-select animate-reveal pb-24">
          
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            {/* Left side: Back Button & Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo('home')}
                className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center shadow-sm"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-650 dark:text-zinc-350" />
              </button>
              <div>
                <p className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">
                  {selectedDailyDate.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Right side: Export & Calendar Archive Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <ExportMergedButton
                lang={lang}
                disabled={todayTransactions.length === 0}
                onExportPDF={async () => {
                  await exportDailyTransactionsToPDF({
                    date: selectedDailyDate,
                    transactions: todayTransactions,
                    lang
                  });
                }}
                onExportCSV={() => {
                  exportDailyTransactionsToCSV({
                    date: selectedDailyDate,
                    transactions: todayTransactions,
                    lang
                  });
                }}
                id="daily_transactions_export_btn"
              />

              <div className="relative shrink-0">
                <input 
                  ref={dateInputRef}
                  type="date"
                  value={getLocalDateString(selectedDailyDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      setSelectedDailyDate(new Date(year, month - 1, day));
                    }
                  }}
                  className="absolute pointer-events-none opacity-0 w-0 h-0"
                  style={{ top: 0, right: 0 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (dateInputRef.current) {
                      try {
                        dateInputRef.current.showPicker();
                      } catch (err) {
                        dateInputRef.current.click();
                      }
                    }
                  }}
                  className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors flex items-center justify-center shadow-sm text-zinc-650 dark:text-zinc-350 cursor-pointer"
                  title={lang === 'bn' ? 'আর্কাইভ তারিখ নির্বাচন' : 'Select Archive Date'}
                >
                  <Calendar className="w-5 h-5 text-[#009966]" />
                </button>
              </div>
            </div>
          </div>

          {/* Prominent highly readable horizontal totals summary grid */}
          <div className="grid grid-cols-3 gap-2 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shrink-0 text-center shadow-sm">
            <div className="space-y-0.5">
              <div className="text-3xs font-extrabold uppercase text-rose-600 dark:text-rose-455 tracking-wider">
                {lang === 'bn' ? 'মোট বকেয়া' : 'Total Dues'}
              </div>
              <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-500">
                +৳ {formatNumber(todayTransactions.filter(tx => tx.type === 'due').reduce((sum, tx) => sum + tx.amount, 0), lang)}
              </div>
            </div>
            <div className="border-l border-zinc-200 dark:border-zinc-800 space-y-0.5">
              <div className="text-3xs font-extrabold uppercase text-emerald-600 dark:text-emerald-455 tracking-wider">
                {lang === 'bn' ? 'মোট আদায়' : 'Total Got'}
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-500">
                -৳ {formatNumber(todayTransactions.filter(tx => tx.type === 'payment').reduce((sum, tx) => sum + tx.amount, 0), lang)}
              </div>
            </div>
            <div className="border-l border-zinc-200 dark:border-zinc-800 space-y-0.5">
              <div className="text-3xs font-extrabold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                {lang === 'bn' ? 'মোট হিসাব' : 'Total Tx'}
              </div>
              <div className="text-base sm:text-lg font-black text-zinc-850 dark:text-white">
                {formatNumber(todayTransactions.length, lang)}
              </div>
            </div>
          </div>

          {/* Centered Reset to Today Button (Only when not showing current day) */}
          {selectedDailyDate.toDateString() !== new Date().toDateString() && (
            <div className="flex justify-center shrink-0">
              <button
                onClick={() => setSelectedDailyDate(new Date())}
                className="py-2 px-4 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-650 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 text-xs font-bold rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span>{lang === 'bn' ? 'আজকের দিনে ফিরে যান' : 'Back to Today'}</span>
              </button>
            </div>
          )}

          {/* Scroll-optimized ledger entries list (grows naturally, no inner scroll, thicker separator line) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-lg overflow-hidden">
            <div className="divide-y-2 divide-zinc-200/80 dark:divide-zinc-800/85">
              {todayTransactions.length === 0 ? (
                <div className="py-16 text-center text-zinc-400 dark:text-zinc-500">
                  <div className="flex flex-col items-center gap-3">
                    <ClipboardList className="w-12 h-12 stroke-[1.5]" />
                    <p className="font-bold text-base">
                      {lang === 'bn' ? 'আজ কোন লেনদেন হয়নি' : 'No transactions recorded'}
                    </p>
                  </div>
                </div>
              ) : (
                todayTransactions.map(tx => (
                  <div 
                    key={tx.id} 
                    onClick={() => navigateTo('customers', tx.customerId)}
                    className="p-4 hover:bg-zinc-50/80 dark:hover:bg-zinc-850/50 transition-colors cursor-pointer flex items-center justify-between gap-4 animate-reveal"
                  >
                    {/* Left side details with icon */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        tx.type === 'due' 
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455' 
                          : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {tx.type === 'due' 
                          ? <ArrowUpRight className="w-4.5 h-4.5 stroke-[2.5]" /> 
                          : <ArrowDownLeft className="w-4.5 h-4.5 stroke-[2.5]" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[17px] sm:text-[18px] font-extrabold text-zinc-850 dark:text-zinc-150 truncate leading-snug">
                          {tx.customerName}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-sm sm:text-[15px] text-zinc-550 dark:text-zinc-400 truncate" title={tx.description}>
                            {tx.description || (tx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                          </span>
                          {tx.tag && (
                            <TagBadge tag={tx.tag} size="sm" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right side details */}
                    <div className="text-right shrink-0">
                      <div className={`font-black text-lg sm:text-xl ${
                        tx.type === 'due' ? 'text-rose-600 dark:text-rose-455' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {tx.type === 'due' ? '+' : '-'} ৳ {formatNumber(tx.amount, lang)}
                      </div>
                      <div className="font-extrabold text-zinc-450 dark:text-zinc-500 mt-0.5" style={{ fontSize: '15px' }}>
                        {new Date(parseFirestoreDate(tx.date)).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
          </motion.div>
        </AnimatePresence>
  )}
  </main>

  {/* FAST ACCESS FLOATING TRIGGER (Only home & customers) */}
  <AnimatePresence>
    {(currentTab === 'home' || currentTab === 'customers') && (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        onClick={openQuickEntry}
        className="fixed bottom-22 sm:bottom-6 right-6 w-14 h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-200 dark:shadow-none transition-colors cursor-pointer z-40"
        title={t.recordEntry}
        id="fab_entry_btn"
      >
        <Plus className="w-8 h-8 stroke-[3]" />
      </motion.button>
    )}
  </AnimatePresence>

  {/* BOTTOM NAVIGATION TABS (Tablet and Smartphone Thumb-Optimized) */}
  <nav className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 py-1.5 px-4 shadow-xl z-40 sm:py-2 md:py-3">
    <div className="max-w-md mx-auto flex items-center justify-between">
      
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => navigateTo('home')}
        className={`relative flex flex-col items-center justify-center gap-1 w-20 py-1 mx-auto cursor-pointer transition-colors ${
          (currentTab === 'home' || currentTab === 'daily_transactions')
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-650'
        }`}
      >
        <div className="relative">
          <LayoutDashboard className="w-6 h-6 stroke-[2]" />
          {(currentTab === 'home' || currentTab === 'daily_transactions') && (
            <motion.div
              layoutId="activeTabPill"
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </div>
        <span className="text-2xs font-semibold">{t.dashboard}</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => navigateTo('customers')}
        className={`relative flex flex-col items-center justify-center gap-1 w-20 py-1 mx-auto cursor-pointer transition-colors ${
          currentTab === 'customers'
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-650'
        }`}
        id="nav_customers_tab"
      >
        <div className="relative">
          <Users className="w-6 h-6 stroke-[2]" />
          {currentTab === 'customers' && (
            <motion.div
              layoutId="activeTabPill"
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </div>
        <span className="text-2xs font-semibold">{t.clients}</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => navigateTo('reminders')}
        className={`relative flex flex-col items-center justify-center gap-1 w-20 py-1 mx-auto cursor-pointer transition-colors ${
          currentTab === 'reminders'
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-650'
        }`}
        id="nav_reminders_tab"
      >
        <div className="relative">
          <Bell className="w-6 h-6 stroke-[2]" />
          {currentTab === 'reminders' && (
            <motion.div
              layoutId="activeTabPill"
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </div>
        <span className="text-2xs font-semibold">{t.reminders}</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => navigateTo('settings')}
        className={`relative flex flex-col items-center justify-center gap-1 w-20 py-1 mx-auto cursor-pointer transition-colors ${
          currentTab === 'settings'
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-650'
        }`}
        id="nav_settings_tab"
      >
        <div className="relative">
          <Settings className="w-6 h-6 stroke-[2]" />
          {currentTab === 'settings' && (
            <motion.div
              layoutId="activeTabPill"
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </div>
        <span className="text-2xs font-semibold">{t.settings}</span>
      </motion.button>

    </div>
  </nav>

   {/* RENDER MASTER QUICK_ADD FORM MODAL */}
 <QuickEntryModal 
 isOpen={isQuickEntryOpen}
 onClose={closeQuickEntry}
 customers={customers}
 createCustomer={createCustomer}
 addTransaction={addTransaction}
 preselectedCustomerId={selectedCustomerIdForDetail || undefined}
 lang={lang}
   transactions={transactions}
  onViewCustomer={navigateToCustomer}
  highlightedTxId={highlightedTxId}
  setHighlightedTxId={setHighlightedTxId}
  />

 {/* APP CUSTOM HIGH-FIDELITY ALERT & CONFIRM MODALS */}
 {appDialog && appDialog.isOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 {/* Backdrop Overlay */}
 <div
 onClick={() => { if (appDialog.type === 'alert') setAppDialog(null); }}
 className="absolute inset-0 bg-black/80"
 />
 
 {/* Modal Body Container */}
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 w-full max-w-sm shadow-2xl relative z-10 text-center space-y-6"
 >
 <div className="space-y-3">
 <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
 {appDialog.title}
 </h3>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
 {appDialog.message}
 </p>
 </div>

 <div className="flex items-center gap-3">
 {appDialog.type === 'confirm' && (
 <button
 type="button"
 onClick={() => {
 if (appDialog.onCancel) appDialog.onCancel();
 setAppDialog(null);
 }}
 className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-150 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 font-extrabold rounded-2xl text-sm transition-colors cursor-pointer"
 >
 {lang === 'bn' ? 'বাতিল' : 'Cancel'}
 </button>
 )}
 <button
 type="button"
 onClick={appDialog.onConfirm}
 className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-750 text-white font-extrabold rounded-2xl text-sm transition-colors cursor-pointer"
 >
 {lang === 'bn' ? 'ঠিক আছে' : 'OK'}
 </button>
 </div>
 </motion.div>
 </div>
 )}

 {/* Role-Restricted Admin Control Panel Modal (itzemon990@gmail.com / Super Admin) */}
 <AdminPanelModal 
   isOpen={isAdminPanelOpen} 
   onClose={() => setIsAdminPanelOpen(false)} 
   lang={lang} 
   isAdmin={isAdmin}
   userEmail={user?.email}
 />

 </div>
 );
}
