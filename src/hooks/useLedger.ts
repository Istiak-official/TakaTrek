import { useState, useEffect, useRef, useMemo } from 'react';
import { 
 collection, 
 doc, 
 setDoc,
 updateDoc, 
 deleteDoc, 
 onSnapshot, 
 query, 
 orderBy, 
 increment, 
 serverTimestamp,
  Timestamp,
 writeBatch,
 limit,
 where
} from 'firebase/firestore';
import { db, auth, OperationType } from '../firebase';
import { Customer, Transaction, Reminder, UserSettings } from '../types';

export function useLedger(userId: string | undefined, selectedDailyDate?: Date) {
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [trashCustomers, setTrashCustomers] = useState<Customer[]>([]);
 const [transactions, setTransactions] = useState<Transaction[]>([]);
 const [reminders, setReminders] = useState<Reminder[]>([]);
 const [settings, setSettings] = useState<UserSettings | null>(null);
 const [loading, setLoading] = useState(true);
 const [customersSynced, setCustomersSynced] = useState(false);
 const [transactionsSynced, setTransactionsSynced] = useState(false);
 const [isOfflineFallback, setIsOfflineFallback] = useState(false);
 const [txLimit, setTxLimit] = useState(150);
 const [hasMoreTxs, setHasMoreTxs] = useState(true);
 const [archiveTransactions, setArchiveTransactions] = useState<Transaction[]>([]);
 const [syncStatus, setSyncStatus] = useState<'saved' | 'syncing' | 'offline'>('saved');

 const activeWritesRef = useRef(0);
 const syncTimerRef = useRef<any>(null);

 const startWrite = () => {
   if (userId === 'local-guest-session' || isOfflineFallback) {
     setSyncStatus('offline');
     return;
   }
   activeWritesRef.current += 1;
   setSyncStatus('syncing');
   if (syncTimerRef.current) {
     clearTimeout(syncTimerRef.current);
     syncTimerRef.current = null;
   }
 };

 const endWrite = () => {
   if (userId === 'local-guest-session' || isOfflineFallback) {
     setSyncStatus('offline');
     return;
   }
   activeWritesRef.current = Math.max(0, activeWritesRef.current - 1);
   if (activeWritesRef.current === 0) {
     if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
     syncTimerRef.current = setTimeout(() => {
       setSyncStatus('saved');
     }, 600);
   }
 };

  const loadMoreTransactions = () => {
    setTxLimit(prev => prev + 150);
  };

 const lastSubmitRef = useRef<{
   timestamp: number;
   customerId: string;
   type: 'due' | 'payment';
   amount: number;
 } | null>(null);

 // Helper: Load all ledger data from local storage
 const loadLocalData = () => {
 if (!userId) return;
 try {
 const storedCustomers = localStorage.getItem(`easy_due_customers_${userId}`);
 const storedTxs = localStorage.getItem(`easy_due_transactions_${userId}`);
 const storedReminders = localStorage.getItem(`easy_due_reminders_${userId}`);
 const storedSettings = localStorage.getItem(`easy_due_settings_${userId}`);

 if (storedCustomers) {
 const parsed = JSON.parse(storedCustomers).map((c: any) => ({
 ...c,
 createdAt: new Date(c.createdAt),
 updatedAt: new Date(c.updatedAt),
 deletedAt: c.deletedAt ? new Date(c.deletedAt) : null
 }));
 setCustomers(parsed.filter((c: any) => !c.isDeleted));
 setTrashCustomers(parsed.filter((c: any) => c.isDeleted));
 } else {
 setCustomers([]);
 setTrashCustomers([]);
 }

 if (storedTxs) {
 setTransactions(JSON.parse(storedTxs).map((t: any) => ({
 ...t,
 date: new Date(t.date),
 createdAt: new Date(t.createdAt)
 })));
 } else {
 setTransactions([]);
 }

 if (storedReminders) {
 setReminders(JSON.parse(storedReminders).map((r: any) => ({
 ...r,
 dueDate: new Date(r.dueDate),
 createdAt: new Date(r.createdAt)
 })));
 } else {
 setReminders([]);
 }

 if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        const loginTheme = sessionStorage.getItem('login_intent_theme');
        if (loginTheme && loginTheme !== parsed.theme) {
          parsed.theme = loginTheme as 'light' | 'dark';
          saveLocalSettings(parsed);
        }
        sessionStorage.removeItem('login_intent_theme');
        setSettings(parsed);
 } else {
        const loginTheme = sessionStorage.getItem('login_intent_theme') || 'light';
        sessionStorage.removeItem('login_intent_theme');
        setSettings({
          uid: userId,
          email: auth.currentUser?.email || 'guest@takatrek.local',
          theme: loginTheme as 'light' | 'dark',
          dailyReminderTime: '09:00',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
 }
 } catch (e) {
 console.warn("Failed to parse local stored ledger data:", e);
 }
 };

 // Local storage save operations
 const saveLocalCustomers = (list: Customer[]) => {
 localStorage.setItem(`easy_due_customers_${userId}`, JSON.stringify(list));
 };
 const saveLocalTransactions = (list: Transaction[]) => {
 localStorage.setItem(`easy_due_transactions_${userId}`, JSON.stringify(list));
 };
 const saveLocalReminders = (list: Reminder[]) => {
 localStorage.setItem(`easy_due_reminders_${userId}`, JSON.stringify(list));
 };
 const saveLocalSettings = (val: UserSettings) => {
 localStorage.setItem(`easy_due_settings_${userId}`, JSON.stringify(val));
 };

  // Load cache immediately on userId change to populate UI with 0ms delay, and set up sync timeout
  useEffect(() => {
    if (userId) {
      loadLocalData();
      
      // Initialize sync tracking states
      setCustomersSynced(false);
      setTransactionsSynced(false);
      
      // If we are offline, mark synced immediately to skip waiting
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setCustomersSynced(true);
        setTransactionsSynced(true);
        return;
      }
      
      // Max wait time for server sync to complete (prevents long loader for slow internet)
      const timer = setTimeout(() => {
        setCustomersSynced(true);
        setTransactionsSynced(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      setCustomers([]);
      setTransactions([]);
      setReminders([]);
      setSettings(null);
      setCustomersSynced(true);
      setTransactionsSynced(true);
    }
  }, [userId]);

  // Monitor sync states to end loading
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (customersSynced && transactionsSynced) {
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [userId, customersSynced, transactionsSynced]);

 // 1. Sync User settings
 useEffect(() => {
 if (!userId) {
 setLoading(false);
 return;
 }

 if (userId === 'local-guest-session' || isOfflineFallback) {
 loadLocalData();
 setLoading(false);
 return;
 }

 const userDocRef = doc(db, 'users', userId);
 const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
 if (docSnap.exists()) {
        const data = docSnap.data() as UserSettings;
        
        const loginTheme = sessionStorage.getItem('login_intent_theme');
        if (loginTheme && loginTheme !== data.theme) {
          data.theme = loginTheme as 'light' | 'dark';
          updateDoc(userDocRef, { theme: loginTheme, updatedAt: serverTimestamp() }).catch(e => console.warn(e));
        }
        sessionStorage.removeItem('login_intent_theme');

        setSettings(data);
        saveLocalSettings(data);
 } else {
        const loginTheme = sessionStorage.getItem('login_intent_theme') || 'light';
        sessionStorage.removeItem('login_intent_theme');
        
        // Initialize default user settings if not exists
        const defaultSettings: UserSettings = {
          uid: userId,
          email: auth.currentUser?.email || '',
          theme: loginTheme as 'light' | 'dark',
          dailyReminderTime: '09:00',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDoc(userDocRef, defaultSettings)
 .then(() => {
 setSettings(defaultSettings);
 saveLocalSettings(defaultSettings);
 })
 .catch(err => {
 console.warn("Firestore error creating user settings, using offline cache fallback:", err);
 loadLocalData();
 });
 }
 }, (error) => {
 console.warn("Firestore error loading user settings, using offline cache fallback:", error);
 loadLocalData();
 });

 return () => unsubscribe();
 }, [userId]);

 // 2. Sync Customers collection
 useEffect(() => {
 if (!userId) return;
 if (userId === 'local-guest-session') {
 return;
 }

 const customersRef = collection(db, 'users', userId, 'customers');
 const q = query(customersRef, orderBy('createdAt', 'desc'));

 const storedCustomers = localStorage.getItem(`easy_due_customers_${userId}`);
 const unsubscribe = onSnapshot(q, (snapshot) => {
   const list: Customer[] = [];
   snapshot.forEach((docSnap) => {
   const data = docSnap.data();
   list.push({
   ...data,
   id: docSnap.id,
   createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
   updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
   deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : (data.deletedAt ? new Date(data.deletedAt) : null)
   } as Customer);
   });
   setCustomers(list.filter(c => !c.isDeleted));
   setTrashCustomers(list.filter(c => c.isDeleted));
   saveLocalCustomers(list);
   if (!snapshot.metadata.fromCache) {
     setCustomersSynced(true);
   }
  }, (error) => {
  console.warn("Firestore error syncing customers list, using offline cache fallback:", error);
  loadLocalData();
  setCustomersSynced(true);
  });

 return () => unsubscribe();
 }, [userId]);

 // 3. Sync Transactions collection
 useEffect(() => {
 if (!userId) return;
 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const txRef = collection(db, 'users', userId, 'transactions');
 const q = query(txRef, orderBy('date', 'desc'), limit(txLimit));

 const unsubscribe = onSnapshot(q, (snapshot) => {
 const list: Transaction[] = [];
 snapshot.forEach((docSnap) => {
 const data = docSnap.data();
 list.push({
 ...data,
 id: docSnap.id,
 date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
 createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
 } as Transaction);
 });
 setTransactions(list);
 saveLocalTransactions(list);
   if (snapshot.size < txLimit) {
     setHasMoreTxs(false);
   } else {
     setHasMoreTxs(true);
   }
   if (!snapshot.metadata.fromCache) {
     setTransactionsSynced(true);
   }
  }, (error) => {
  console.warn("Firestore error syncing transactions, using offline cache fallback:", error);
  loadLocalData();
  setTransactionsSynced(true);
  });

 return () => unsubscribe();
 }, [userId, txLimit]);

  // 3b. Sync Daily Archive Transactions (only for past dates when online)
  useEffect(() => {
    if (!userId || userId === 'local-guest-session' || isOfflineFallback || !selectedDailyDate) {
      setArchiveTransactions([]);
      return;
    }

    const filterDateStr = selectedDailyDate.toDateString();
    const isToday = filterDateStr === new Date().toDateString();

    if (isToday) {
      setArchiveTransactions([]);
      return;
    }

    // Archive Date: Query firestore directly for the selected date range
    const startOfDay = new Date(selectedDailyDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDailyDate);
    endOfDay.setHours(23, 59, 59, 999);

    const txRef = collection(db, 'users', userId, 'transactions');
    const q = query(
      txRef,
      orderBy('date', 'desc'),
      where('date', '>=', startOfDay),
      where('date', '<=', endOfDay)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          ...data,
          id: docSnap.id,
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
        } as Transaction);
      });
      setArchiveTransactions(list);
    }, (error) => {
      console.warn("Firestore error syncing daily archive transactions:", error);
    });

    return () => unsubscribe();
  }, [userId, selectedDailyDate, isOfflineFallback]);

  // Compute daily transactions dynamically based on date context
  const dailyTransactions = useMemo(() => {
    if (!selectedDailyDate) return [];
    
    const filterDateStr = selectedDailyDate.toDateString();
    const isToday = filterDateStr === new Date().toDateString();

    if (isToday || isOfflineFallback || userId === 'local-guest-session') {
      return transactions
        .filter(tx => {
          const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
          return d.toDateString() === filterDateStr;
        })
        .sort((a, b) => {
          const dateA = a.date instanceof Date ? a.date : new Date(a.date);
          const dateB = b.date instanceof Date ? b.date : new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });
    }

    return archiveTransactions;
  }, [transactions, selectedDailyDate, isOfflineFallback, userId, archiveTransactions]);

 // 4. Sync Reminders collection
 useEffect(() => {
 if (!userId) return;
 if (userId === 'local-guest-session') {
 return;
 }

 const remindersRef = collection(db, 'users', userId, 'reminders');
 const q = query(remindersRef, orderBy('dueDate', 'asc'));

 const unsubscribe = onSnapshot(q, (snapshot) => {
 const list: Reminder[] = [];
 snapshot.forEach((docSnap) => {
 const data = docSnap.data();
 list.push({
 ...data,
 id: docSnap.id,
 dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate),
 createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
 } as Reminder);
 });
 setReminders(list);
 saveLocalReminders(list);
 }, (error) => {
 console.warn("Firestore error syncing reminders, using offline cache fallback:", error);
 loadLocalData();
 });

 return () => unsubscribe();
 }, [userId]);

 // --- ACTIONS ---

 // Update theme setting
 const updateTheme = async (theme: 'light' | 'dark') => {
 if (!userId) return;
 const updatedSettings = settings ? { ...settings, theme, updatedAt: new Date() } : {
 uid: userId,
 email: auth.currentUser?.email || 'guest@takatrek.local',
 theme,
 dailyReminderTime: '09:00',
 createdAt: new Date(),
 updatedAt: new Date()
 };
 setSettings(updatedSettings);
 saveLocalSettings(updatedSettings);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const userDocRef = doc(db, 'users', userId);
 try {
 await updateDoc(userDocRef, {
 theme,
 updatedAt: serverTimestamp()
 });
 } catch (err) {
 console.warn("Firestore updateTheme failed, saved locally:", err);
 }
 };

 // Update general settings
 const updateSettings = async (time: string) => {
 if (!userId) return;
 const updatedSettings = settings ? { ...settings, dailyReminderTime: time, updatedAt: new Date() } : {
 uid: userId,
 email: auth.currentUser?.email || 'guest@takatrek.local',
 theme: 'light' as const,
 dailyReminderTime: time,
 createdAt: new Date(),
 updatedAt: new Date()
 };
 setSettings(updatedSettings);
 saveLocalSettings(updatedSettings);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const userDocRef = doc(db, 'users', userId);
 try {
 await updateDoc(userDocRef, {
 dailyReminderTime: time,
 updatedAt: serverTimestamp()
 });
 } catch (err) {
 console.warn("Firestore updateSettings failed, saved locally:", err);
	}
	};

  // Update daily collection target
  const updateDailyTarget = async (target: number) => {
    if (!userId) return;
    const updatedSettings: UserSettings = settings ? { ...settings, dailyCollectionTarget: target, updatedAt: new Date() } : {
      uid: userId,
      email: auth.currentUser?.email || 'guest@takatrek.local',
      theme: 'light' as const,
      dailyReminderTime: '09:00',
      dailyCollectionTarget: target,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setSettings(updatedSettings);
    saveLocalSettings(updatedSettings);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    const userDocRef = doc(db, 'users', userId);
    try {
      await updateDoc(userDocRef, {
        dailyCollectionTarget: target,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore updateDailyTarget failed, saved locally:", err);
    }
  };

 // Create new customer
 const createCustomer = async (name: string, phone: string, notes: string = '') => {
 if (!userId) return null;
 
 const trimmedName = name.trim();
 // Case-insensitive duplicate name check
 const isDuplicate = customers.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
 if (isDuplicate) {
 throw new Error('DUPLICATE_NAME');
 }

 const customId = doc(collection(db, 'temp')).id;
 const newCustomer: Customer = {
 id: customId,
 userId,
 name: trimmedName,
 phone: phone.trim(),
 notes: notes.trim(),
 outstandingDue: 0,
 createdAt: new Date(),
 updatedAt: new Date()
 };

 const updatedList = [newCustomer, ...customers];
 setCustomers(updatedList);
 saveLocalCustomers(updatedList);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return customId;
 }

 const customersRef = collection(db, 'users', userId, 'customers');
 const newDocRef = doc(customersRef, customId);
 try {
 await setDoc(newDocRef, {
 ...newCustomer,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp()
 });
 return customId;
 } catch (err) {
 console.warn("Firestore createCustomer failed, saved locally:", err);
 return customId;
 }
 };

 // Record a new transaction (due or payment) and update customer balance
 const addTransaction = async (
   customerId: string, 
   type: 'due' | 'payment', 
   amount: number, 
   description: string = '', 
   date: Date = new Date(),
   fallbackCustomerInfo?: { name: string; phone: string },
    tag?: string
  ) => {
   if (!userId) return;

   // Accidental Time-Based Double-Click prevention
   const now = Date.now();
   if (lastSubmitRef.current) {
     const { timestamp, customerId: prevCustId, type: prevType, amount: prevAmount } = lastSubmitRef.current;
     if (
       now - timestamp < 1000 &&
       prevCustId === customerId &&
       prevType === type &&
       prevAmount === amount
     ) {
       console.warn("Blocked duplicate transaction submission within 1 second.");
       return;
     }
   }
   lastSubmitRef.current = { timestamp: now, customerId, type, amount };
 
 let customer = customers.find(c => c.id === customerId);
 let customerName = customer?.name || fallbackCustomerInfo?.name;
 if (!customerName) throw new Error('Customer not found');

 const customTxId = doc(collection(db, 'temp')).id;
 const diff = type === 'due' ? amount : -amount;

 const newTx: Transaction = {
 id: customTxId,
 userId,
 customerId,
 customerName: customerName,
 type,
 amount,
 description: description.trim(),
    tag: tag ? tag.trim() : undefined,
    date,
 createdAt: new Date()
 };

 const updatedTxs = [newTx, ...transactions];
 
 let found = false;
 let updatedCustomers = customers.map(c => {
 if (c.id === customerId) {
 found = true;
 return { ...c, outstandingDue: c.outstandingDue + diff, updatedAt: new Date() };
 }
 return c;
 });

 // If customer was newly created and not yet in the stale customers state list, add them inline
 if (!found && fallbackCustomerInfo) {
 const newCustomer: Customer = {
 id: customerId,
 userId,
 name: fallbackCustomerInfo.name.trim(),
 phone: fallbackCustomerInfo.phone.trim(),
 outstandingDue: diff,
 createdAt: new Date(),
 updatedAt: new Date()
 };
 updatedCustomers = [newCustomer, ...updatedCustomers];
 }

 setTransactions(updatedTxs);
 setCustomers(updatedCustomers);
 saveLocalTransactions(updatedTxs);
 saveLocalCustomers(updatedCustomers);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const txRef = collection(db, 'users', userId, 'transactions');
 const newTxDoc = doc(txRef, customTxId);
 const customerDocRef = doc(db, 'users', userId, 'customers', customerId);

 const batch = writeBatch(db);
 const firestoreTxData: any = {
    ...newTx,
    date,
    createdAt: serverTimestamp()
  };
  if (!tag || !tag.trim()) {
    delete firestoreTxData.tag;
  }
  batch.set(newTxDoc, firestoreTxData);
 
 // In Firestore, if this customer was just created, updateDoc or setDoc is safe since we did await setDoc earlier
 batch.update(customerDocRef, {
 outstandingDue: increment(diff),
 updatedAt: serverTimestamp()
 });

 try {
 await batch.commit();
 } catch (err) {
 console.warn("Firestore addTransaction failed, saved locally:", err);
 }
 };

 // Add a reminder for customer
 const addReminder = async (customerId: string, notes: string, dueDate: Date) => {
 if (!userId) return;
 const customer = customers.find(c => c.id === customerId);
 if (!customer) return;

 const customRemId = doc(collection(db, 'temp')).id;
 const newReminder: Reminder = {
 id: customRemId,
 userId,
 customerId,
 customerName: customer.name,
 notes: notes.trim(),
 dueDate,
 active: true,
 createdAt: new Date()
 };

 const updatedReminders = [newReminder, ...reminders];
 setReminders(updatedReminders);
 saveLocalReminders(updatedReminders);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const remindersRef = collection(db, 'users', userId, 'reminders');
 const newReminderRef = doc(remindersRef, customRemId);
 try {
 await setDoc(newReminderRef, {
 ...newReminder,
 dueDate,
 createdAt: serverTimestamp()
 });
 } catch (err) {
 console.warn("Firestore addReminder failed, saved locally:", err);
 }
 };

 // Toggle/Edit a Reminder status
 const toggleReminder = async (reminderId: string, active: boolean) => {
 if (!userId) return;
 const updatedReminders = reminders.map(r => r.id === reminderId ? { ...r, active } : r);
 setReminders(updatedReminders);
 saveLocalReminders(updatedReminders);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const reminderRef = doc(db, 'users', userId, 'reminders', reminderId);
 try {
 await updateDoc(reminderRef, { active });
 } catch (err) {
 console.warn("Firestore toggleReminder failed, saved locally:", err);
 }
 };

 // Delete a Reminder
 const deleteReminder = async (reminderId: string) => {
 if (!userId) return;
 const updatedReminders = reminders.filter(r => r.id !== reminderId);
 setReminders(updatedReminders);
 saveLocalReminders(updatedReminders);

 if (userId === 'local-guest-session' || isOfflineFallback) {
 return;
 }

 const reminderRef = doc(db, 'users', userId, 'reminders', reminderId);
 try {
 await deleteDoc(reminderRef);
 } catch (err) {
 console.warn("Firestore deleteReminder failed, saved locally:", err);
 }
 };

  // Delete a customer (soft delete to Trash)
  const deleteCustomer = async (customerId: string) => {
    if (!userId) return;
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const deletedCustomer = { ...customer, isDeleted: true, deletedAt: new Date() };

    const updatedCustomers = customers.filter(c => c.id !== customerId);
    const updatedTrash = [deletedCustomer, ...trashCustomers];

    setCustomers(updatedCustomers);
    setTrashCustomers(updatedTrash);
    saveLocalCustomers([...updatedCustomers, ...updatedTrash]);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    startWrite();
    const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
    try {
      await updateDoc(customerDocRef, {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Firestore soft deleteCustomer failed, saved locally:", err);
    } finally {
      endWrite();
    }
  };

  // Restore a customer from Trash
  const restoreCustomer = async (customerId: string) => {
    if (!userId) return;
    const customer = trashCustomers.find(c => c.id === customerId);
    if (!customer) return;

    const restoredCustomer = { ...customer, isDeleted: false, deletedAt: null };

    const updatedTrash = trashCustomers.filter(c => c.id !== customerId);
    const updatedCustomers = [restoredCustomer, ...customers];

    setCustomers(updatedCustomers);
    setTrashCustomers(updatedTrash);
    saveLocalCustomers([...updatedCustomers, ...updatedTrash]);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    startWrite();
    const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
    try {
      await updateDoc(customerDocRef, {
        isDeleted: false,
        deletedAt: null
      });
    } catch (err) {
      console.warn("Firestore restoreCustomer failed, saved locally:", err);
    } finally {
      endWrite();
    }
  };

  // Permanently delete a customer, their transactions, and reminders
  const permanentlyDeleteCustomer = async (customerId: string) => {
    if (!userId) return;

    const updatedTrash = trashCustomers.filter(c => c.id !== customerId);
    const updatedCustomers = customers.filter(c => c.id !== customerId);

    setCustomers(updatedCustomers);
    setTrashCustomers(updatedTrash);
    saveLocalCustomers([...updatedCustomers, ...updatedTrash]);

    const updatedTxs = transactions.filter(t => t.customerId !== customerId);
    const updatedReminders = reminders.filter(r => r.customerId !== customerId);
    setTransactions(updatedTxs);
    setReminders(updatedReminders);
    saveLocalTransactions(updatedTxs);
    saveLocalReminders(updatedReminders);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    startWrite();
    const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
    const relatedTxs = transactions.filter(t => t.customerId === customerId);
    const relatedReminders = reminders.filter(r => r.customerId === customerId);

    const batch = writeBatch(db);
    batch.delete(customerDocRef);
    relatedTxs.forEach(tx => {
      batch.delete(doc(db, 'users', userId, 'transactions', tx.id));
    });
    relatedReminders.forEach(rem => {
      batch.delete(doc(db, 'users', userId, 'reminders', rem.id));
    });

    try {
      await batch.commit();
    } catch (err) {
      console.warn("Firestore permanentlyDeleteCustomer failed, saved locally:", err);
    } finally {
      endWrite();
    }
  };

  // Empty the entire Trash
  const emptyTrash = async () => {
    if (!userId) return;

    const idsToDelete = trashCustomers.map(c => c.id);

    setTrashCustomers([]);
    saveLocalCustomers(customers);

    const updatedTxs = transactions.filter(t => !idsToDelete.includes(t.customerId));
    const updatedReminders = reminders.filter(r => !idsToDelete.includes(r.customerId));
    setTransactions(updatedTxs);
    setReminders(updatedReminders);
    saveLocalTransactions(updatedTxs);
    saveLocalReminders(updatedReminders);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    startWrite();
    try {
      for (const customerId of idsToDelete) {
        const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
        const relatedTxs = transactions.filter(t => t.customerId === customerId);
        const relatedReminders = reminders.filter(r => r.customerId === customerId);

        const batch = writeBatch(db);
        batch.delete(customerDocRef);
        relatedTxs.forEach(tx => {
          batch.delete(doc(db, 'users', userId, 'transactions', tx.id));
        });
        relatedReminders.forEach(rem => {
          batch.delete(doc(db, 'users', userId, 'reminders', rem.id));
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn("Firestore emptyTrash failed, saved locally:", err);
    } finally {
      endWrite();
    }
  };

  const updateCustomerDetails = async (customerId: string, name: string, phone: string, notes?: string) => {
    if (!userId) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedNotes = notes !== undefined ? notes.trim() : undefined;

    // Check for duplicate name excluding the customer being updated
    const isDuplicate = customers.some(c => c.id !== customerId && c.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      throw new Error('DUPLICATE_NAME');
    }

    const updatedList = customers.map(c => 
      c.id === customerId ? { 
        ...c, 
        name: trimmedName, 
        phone: trimmedPhone, 
        ...(trimmedNotes !== undefined ? { notes: trimmedNotes } : {}),
        updatedAt: new Date() 
      } : c
    );
    setCustomers(updatedList);
    saveLocalCustomers(updatedList);

    if (userId === 'local-guest-session' || isOfflineFallback) {
      return;
    }

    startWrite();
    const customerDocRef = doc(db, 'users', userId, 'customers', customerId);
    try {
      const payload: any = {
        name: trimmedName,
        phone: trimmedPhone,
        updatedAt: serverTimestamp()
      };
      if (trimmedNotes !== undefined) {
        payload.notes = trimmedNotes;
      }
      await updateDoc(customerDocRef, payload);
    } catch (err) {
      console.warn("Firestore updateCustomerDetails failed, saved locally:", err);
    } finally {
      endWrite();
    }
  };

  // Edit a transaction
  const editTransaction = async (
    transactionId: string,
    newType: 'due' | 'payment',
    newAmount: number,
    newDescription: string,
    newTag?: string
  ) => {
    if (!userId) return;

    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return;

    const diffOld = tx.type === 'due' ? -tx.amount : tx.amount; // reverse old effect
    const diffNew = newType === 'due' ? newAmount : -newAmount; // apply new effect
    const netDiff = diffOld + diffNew;

    const updatedTxs = transactions.map(t => 
      t.id === transactionId 
        ? { ...t, type: newType, amount: newAmount, description: newDescription.trim(), tag: newTag !== undefined ? (newTag.trim() || undefined) : t.tag } 
        : t
    );

    const updatedCustomers = customers.map(c => 
      c.id === tx.customerId 
        ? { ...c, outstandingDue: c.outstandingDue + netDiff, updatedAt: new Date() }
        : c
    );

    setTransactions(updatedTxs);
    setCustomers(updatedCustomers);
    saveLocalTransactions(updatedTxs);
    saveLocalCustomers(updatedCustomers);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    startWrite();
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', userId, 'transactions', transactionId), {
      type: newType,
      amount: newAmount,
      description: newDescription.trim(),
      tag: newTag !== undefined ? newTag.trim() : (tx.tag || "")
    });
    batch.update(doc(db, 'users', userId, 'customers', tx.customerId), {
      outstandingDue: increment(netDiff),
      updatedAt: serverTimestamp()
    });

    try {
      await batch.commit();
    } catch (err) {
      console.warn("Firestore editTransaction failed, saved locally:", err);
    } finally {
      endWrite();
    }
  };

  // Delete a transaction
  const deleteTransaction = async (transactionId: string) => {
    if (!userId) return;

    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return;

    const diff = tx.type === 'due' ? -tx.amount : tx.amount;

    const updatedTxs = transactions.filter(t => t.id !== transactionId);
    const updatedCustomers = customers.map(c => 
      c.id === tx.customerId 
        ? { ...c, outstandingDue: c.outstandingDue + diff, updatedAt: new Date() }
        : c
    );

    setTransactions(updatedTxs);
    setCustomers(updatedCustomers);
    saveLocalTransactions(updatedTxs);
    saveLocalCustomers(updatedCustomers);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    startWrite();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'transactions', transactionId));
    batch.update(doc(db, 'users', userId, 'customers', tx.customerId), {
      outstandingDue: increment(diff),
      updatedAt: serverTimestamp()
    });

    try {
      await batch.commit();
    } catch (err) {
      console.warn("Firestore deleteTransaction failed, saved locally:", err);
    } finally {
      endWrite();
    }
  };

  // Restore a deleted transaction (e.g. within Undo window)
  const restoreTransaction = async (tx: Transaction) => {
    if (!userId || !tx) return;

    if (transactions.some(t => t.id === tx.id)) return;

    const reverseDiff = tx.type === 'due' ? tx.amount : -tx.amount;

    const updatedTxs = [tx, ...transactions.filter(t => t.id !== tx.id)].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const updatedCustomers = customers.map(c => 
      c.id === tx.customerId 
        ? { ...c, outstandingDue: c.outstandingDue + reverseDiff, updatedAt: new Date() }
        : c
    );

    setTransactions(updatedTxs);
    setCustomers(updatedCustomers);
    saveLocalTransactions(updatedTxs);
    saveLocalCustomers(updatedCustomers);

    if (userId === 'local-guest-session' || isOfflineFallback) return;

    startWrite();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', userId, 'transactions', tx.id), {
      customerId: tx.customerId,
      customerName: tx.customerName,
      type: tx.type,
      amount: tx.amount,
      description: tx.description || '',
      tag: tx.tag || null,
      date: Timestamp.fromDate(new Date(tx.date)),
      createdAt: serverTimestamp()
    });
    batch.update(doc(db, 'users', userId, 'customers', tx.customerId), {
      outstandingDue: increment(reverseDiff),
      updatedAt: serverTimestamp()
    });

    try {
      await batch.commit();
    } catch (err) {
      console.warn("Firestore restoreTransaction failed, saved locally:", err);
    } finally {
      endWrite();
    }
  };

  const importLedgerData = async (
    backupData: any,
    choice: 'merge' | 'clear' | 'skip'
  ) => {
    if (!userId) return;

    const isLocal = userId === 'local-guest-session' || isOfflineFallback;

    // Validate structure
    if (!backupData || !Array.isArray(backupData.customers) || !Array.isArray(backupData.ledgerTransactions)) {
      throw new Error('INVALID_BACKUP_FILE');
    }

    // List of Firestore operations to commit
    const operations: { ref: any; data: any; type: 'set' | 'update' | 'delete' }[] = [];

    // Local copies of states we'll update
    let newCustomers: Customer[] = [...customers];
    let newTrash: Customer[] = [...trashCustomers];
    let newTransactions: Transaction[] = [...transactions];
    let newReminders: Reminder[] = [...reminders];

    if (choice === 'clear') {
      // Clear Firestore references for existing customers, transactions, and reminders
      if (!isLocal) {
        // Collect deletes for existing customers (both active and trash)
        for (const c of customers) {
          operations.push({
            ref: doc(db, 'users', userId, 'customers', c.id),
            data: null,
            type: 'delete'
          });
        }
        for (const c of trashCustomers) {
          operations.push({
            ref: doc(db, 'users', userId, 'customers', c.id),
            data: null,
            type: 'delete'
          });
        }
        // Collect deletes for transactions
        for (const tx of transactions) {
          operations.push({
            ref: doc(db, 'users', userId, 'transactions', tx.id),
            data: null,
            type: 'delete'
          });
        }
        // Collect deletes for reminders
        for (const r of reminders) {
          operations.push({
            ref: doc(db, 'users', userId, 'reminders', r.id),
            data: null,
            type: 'delete'
          });
        }
      }

      // Reset local variables
      newCustomers = [];
      newTrash = [];
      newTransactions = [];
      newReminders = [];

      // Create new customers from backup
      const customerMap = new Map<string, Customer>(); // name lowercased -> Customer object
      
      for (const bc of backupData.customers) {
        if (!bc.name) continue;
        const customId = doc(collection(db, 'temp')).id;
        const cDate = bc.createdAt ? new Date(bc.createdAt) : new Date();
        const customerObj: Customer = {
          id: customId,
          userId,
          name: bc.name.trim(),
          phone: (bc.phone || '').trim(),
          outstandingDue: bc.outstandingDue || 0,
          createdAt: cDate,
          updatedAt: new Date()
        };
        customerMap.set(bc.name.trim().toLowerCase(), customerObj);
        newCustomers.push(customerObj);

        if (!isLocal) {
          operations.push({
            ref: doc(db, 'users', userId, 'customers', customId),
            data: {
              id: customId,
              userId,
              name: bc.name.trim(),
              phone: (bc.phone || '').trim(),
              outstandingDue: bc.outstandingDue || 0,
              createdAt: cDate,
              updatedAt: new Date()
            },
            type: 'set'
          });
        }
      }

      // Create transactions from backup
      for (const bt of backupData.ledgerTransactions) {
        const cName = bt.customer || (bt as any).customerName; if (!cName) continue;
        const customerNameLower = cName.trim().toLowerCase();
        let matchedCustomer = customerMap.get(customerNameLower);
        
        // If the customer isn't in the customer list for some reason, create them
        if (!matchedCustomer) {
          const customId = doc(collection(db, 'temp')).id;
          const customerObj: Customer = {
            id: customId,
            userId,
            name: cName.trim(),
            phone: '',
            outstandingDue: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          customerMap.set(customerNameLower, customerObj);
          newCustomers.push(customerObj);
          matchedCustomer = customerObj;

          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'customers', customId),
              data: {
                id: customId,
                userId,
                name: cName.trim(),
                phone: '',
                outstandingDue: 0,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              type: 'set'
            });
          }
        }

        const customTxId = doc(collection(db, 'temp')).id;
        const txDate = bt.date ? new Date(bt.date) : new Date();
        const txObj: Transaction = {
          id: customTxId,
          userId,
          customerId: matchedCustomer.id,
          customerName: matchedCustomer.name,
          type: bt.type,
          amount: bt.amount,
          description: (bt.description || '').trim(),
          date: txDate,
          createdAt: txDate
        };
        newTransactions.push(txObj);

        if (!isLocal) {
          operations.push({
            ref: doc(db, 'users', userId, 'transactions', customTxId),
            data: {
              id: customTxId,
              userId,
              customerId: matchedCustomer.id,
              customerName: matchedCustomer.name,
              type: bt.type,
              amount: bt.amount,
              description: (bt.description || '').trim(),
              date: txDate,
              createdAt: txDate
            },
            type: 'set'
          });
        }
      }
    } else {
      // choice === 'merge' or 'skip'
      // 1. Process customers
      // Keep track of the current active customers by name
      const customerMap = new Map<string, Customer>();
      for (const c of newCustomers) {
        customerMap.set(c.name.trim().toLowerCase(), c);
      }

      for (const bc of backupData.customers) {
        if (!bc.name) continue;
        const key = bc.name.trim().toLowerCase();
        const existing = customerMap.get(key);

        if (existing) {
          if (choice === 'merge') {
            // Update phone if different
            const backupPhone = (bc.phone || '').trim();
            if (backupPhone && existing.phone !== backupPhone) {
              existing.phone = backupPhone;
              existing.updatedAt = new Date();
              
              if (!isLocal) {
                operations.push({
                  ref: doc(db, 'users', userId, 'customers', existing.id),
                  data: { phone: backupPhone, updatedAt: new Date() },
                  type: 'update'
                });
              }
            }
          }
        } else {
          // Customer does not exist, create new one
          const customId = doc(collection(db, 'temp')).id;
          const cDate = bc.createdAt ? new Date(bc.createdAt) : new Date();
          const customerObj: Customer = {
            id: customId,
            userId,
            name: bc.name.trim(),
            phone: (bc.phone || '').trim(),
            outstandingDue: 0, // will accumulate from new transactions
            createdAt: cDate,
            updatedAt: new Date()
          };
          customerMap.set(key, customerObj);
          newCustomers.push(customerObj);

          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'customers', customId),
              data: {
                id: customId,
                userId,
                name: bc.name.trim(),
                phone: (bc.phone || '').trim(),
                outstandingDue: 0,
                createdAt: cDate,
                updatedAt: new Date()
              },
              type: 'set'
            });
          }
        }
      }

      // 2. Process transactions
      for (const bt of backupData.ledgerTransactions) {
        const cName = bt.customer || (bt as any).customerName; if (!cName) continue;
        const key = cName.trim().toLowerCase();
        let matchedCustomer = customerMap.get(key);

        // If customer doesn't exist (can happen if transactions contains entries for someone not in customers list)
        if (!matchedCustomer) {
          const customId = doc(collection(db, 'temp')).id;
          const customerObj: Customer = {
            id: customId,
            userId,
            name: cName.trim(),
            phone: '',
            outstandingDue: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          customerMap.set(key, customerObj);
          newCustomers.push(customerObj);
          matchedCustomer = customerObj;

          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'customers', customId),
              data: {
                id: customId,
                userId,
                name: cName.trim(),
                phone: '',
                outstandingDue: 0,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              type: 'set'
            });
          }
        }

        // Check if transaction already exists in our live transaction list
        const btDateMs = bt.date ? new Date(bt.date).getTime() : 0;
        const exists = newTransactions.some(tx => {
          if (tx.customerId !== matchedCustomer!.id) return false;
          if (tx.type !== bt.type) return false;
          if (tx.amount !== bt.amount) return false;
          if ((tx.description || '').trim() !== (bt.description || '').trim()) return false;
          // Compare dates with tolerance (within 1 second)
          const txDateMs = new Date(tx.date).getTime();
          return Math.abs(txDateMs - btDateMs) < 1000;
        });

        if (!exists) {
          const customTxId = doc(collection(db, 'temp')).id;
          const txDate = bt.date ? new Date(bt.date) : new Date();
          const txObj: Transaction = {
            id: customTxId,
            userId,
            customerId: matchedCustomer.id,
            customerName: matchedCustomer.name,
            type: bt.type,
            amount: bt.amount,
            description: (bt.description || '').trim(),
            date: txDate,
            createdAt: txDate
          };
          newTransactions.push(txObj);

          if (!isLocal) {
            operations.push({
              ref: doc(db, 'users', userId, 'transactions', customTxId),
              data: {
                id: customTxId,
                userId,
                customerId: matchedCustomer.id,
                customerName: matchedCustomer.name,
                type: bt.type,
                amount: bt.amount,
                description: (bt.description || '').trim(),
                date: txDate,
                createdAt: txDate
              },
              type: 'set'
            });
          }

          // Accumulate balance
          const diff = bt.type === 'due' ? bt.amount : -bt.amount;
          matchedCustomer.outstandingDue += diff;
          matchedCustomer.updatedAt = new Date();
        }
      }

      // Sync customer balance updates to Firestore for customers that had updates
      if (!isLocal) {
        for (const c of newCustomers) {
          const opIndex = operations.findIndex(op => op.type === 'set' && op.ref.id === c.id);
          if (opIndex >= 0) {
            // Update the set operation data
            operations[opIndex].data.outstandingDue = c.outstandingDue;
            operations[opIndex].data.updatedAt = c.updatedAt;
          } else {
            // Check if customer outstandingDue changed from original.
            const original = customers.find(orig => orig.id === c.id);
            if (original && (original.outstandingDue !== c.outstandingDue || original.phone !== c.phone)) {
              operations.push({
                ref: doc(db, 'users', userId, 'customers', c.id),
                data: { 
                  outstandingDue: c.outstandingDue, 
                  phone: c.phone, 
                  updatedAt: c.updatedAt 
                },
                type: 'update'
              });
            }
          }
        }
      }
    }

    // Execute Firestore operations in chunks of 400
    if (!isLocal && operations.length > 0) {
      const chunkArray = <T>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const chunks = chunkArray(operations, 400);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const op of chunk) {
          if (op.type === 'set') {
            batch.set(op.ref, op.data);
          } else if (op.type === 'update') {
            batch.update(op.ref, op.data);
          } else if (op.type === 'delete') {
            batch.delete(op.ref);
          }
        }
        await batch.commit();
      }
    }

    // Update local state
    setCustomers(newCustomers.filter(c => !c.isDeleted));
    setTrashCustomers(newTrash);
    setTransactions(newTransactions);
    setReminders(newReminders);

    // Save to local storage
    saveLocalCustomers([...newCustomers, ...newTrash]);
    saveLocalTransactions(newTransactions);
    saveLocalReminders(newReminders);
  };

  // 5. Automatic cleanup of trashed items older than 7 days
  useEffect(() => {
    if (!userId || loading || trashCustomers.length === 0) return;

    const now = new Date().getTime();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    
    const expiredCustomers = trashCustomers.filter(c => {
      if (!c.deletedAt) return false;
      const deletedTime = new Date(c.deletedAt).getTime();
      return (now - deletedTime) > sevenDaysInMs;
    });

    if (expiredCustomers.length > 0) {
      expiredCustomers.forEach(c => {
        permanentlyDeleteCustomer(c.id);
      });
    }
  }, [userId, loading, trashCustomers]);

  return {
    customers,
    trashCustomers,
    transactions: transactions.filter(t => customers.some(c => c.id === t.customerId)),
    dailyTransactions: dailyTransactions.filter(t => customers.some(c => c.id === t.customerId)),
    reminders: reminders.filter(r => customers.some(c => c.id === r.customerId)),
    settings,
    loading,
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
    restoreCustomer,
    permanentlyDeleteCustomer,
    emptyTrash,
    importLedgerData,
    hasMoreTxs,
    loadMoreTransactions
  };
}
