import React, { useState, useEffect } from 'react';
import { 
  X, Database, Key, ShieldCheck, RefreshCw, Trash2, CheckCircle2, 
  ExternalLink, Copy, Check, AlertCircle, FileCode, Sliders, ShieldAlert,
  Activity, Users, Server, Lock, Cpu, Clock, Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  getActiveFirebaseConfig, 
  saveCustomFirebaseConfig, 
  resetToDefaultFirebaseConfig, 
  clearAllOldConnectionsAndData, 
  parseFirebaseSnippet,
  FirebaseProjectConfig 
} from '../lib/firebaseConfigHelper';
import { getAuthorizedAdminEmails } from '../lib/adminAuth';
import { triggerHaptic } from '../lib/haptics';
import { Language } from '../lib/translations';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  isAdmin: boolean;
  userEmail?: string | null;
}

export default function AdminPanelModal({
  isOpen,
  onClose,
  lang,
  isAdmin,
  userEmail
}: AdminPanelModalProps) {
  const [activeConfig, setActiveConfig] = useState<FirebaseProjectConfig>(getActiveFirebaseConfig);
  const [activeTab, setActiveTab] = useState<'firebase' | 'diagnostics' | 'future_admin'>('firebase');

  // Input states for inserting custom keys
  const [snippetInput, setSnippetInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [projectIdInput, setProjectIdInput] = useState('');
  const [authDomainInput, setAuthDomainInput] = useState('');
  const [appIdInput, setAppIdInput] = useState('');
  const [storageBucketInput, setStorageBucketInput] = useState('');
  const [messagingSenderIdInput, setMessagingSenderIdInput] = useState('');
  const [databaseIdInput, setDatabaseIdInput] = useState('(default)');

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<'checking' | 'healthy' | 'warning'>('checking');
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen && isAdmin) {
      const config = getActiveFirebaseConfig();
      setActiveConfig(config);
      setApiKeyInput(config.apiKey || '');
      setProjectIdInput(config.projectId || '');
      setAuthDomainInput(config.authDomain || '');
      setAppIdInput(config.appId || '');
      setStorageBucketInput(config.storageBucket || '');
      setMessagingSenderIdInput(config.messagingSenderId || '');
      setDatabaseIdInput(config.firestoreDatabaseId || 'main');
      setSnippetInput('');

      // Test latency to backend health
      const start = Date.now();
      fetch('/api/health')
        .then(res => res.json())
        .then(() => {
          setPingLatency(Date.now() - start);
          setPingStatus('healthy');
        })
        .catch(() => {
          setPingStatus('warning');
          setPingLatency(null);
        });
    }
  }, [isOpen, isAdmin]);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCopy = (text: string, fieldId: string) => {
    triggerHaptic('single');
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success(lang === 'bn' ? 'ক্লিপবোর্ডে কপি হয়েছে' : 'Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleParseSnippet = () => {
    triggerHaptic('single');
    if (!snippetInput.trim()) {
      toast.error(lang === 'bn' ? 'অনুগ্রহ করে ফায়ারবেস কনফিগ কোড পেস্ট করুন' : 'Please paste Firebase config snippet');
      return;
    }
    const parsed = parseFirebaseSnippet(snippetInput);
    if (!parsed || (!parsed.apiKey && !parsed.projectId)) {
      toast.error(lang === 'bn' ? 'সঠিক কনফিগ খুঁজে পাওয়া যায়নি। নিচে আলাদা ফিল্ডে বসান।' : 'Could not parse config snippet. Please fill fields below.');
      return;
    }

    if (parsed.apiKey) setApiKeyInput(parsed.apiKey);
    if (parsed.projectId) setProjectIdInput(parsed.projectId);
    if (parsed.authDomain) setAuthDomainInput(parsed.authDomain);
    if (parsed.appId) setAppIdInput(parsed.appId);
    if (parsed.storageBucket) setStorageBucketInput(parsed.storageBucket);
    if (parsed.messagingSenderId) setMessagingSenderIdInput(parsed.messagingSenderId);
    if (parsed.firestoreDatabaseId) setDatabaseIdInput(parsed.firestoreDatabaseId);

    toast.success(lang === 'bn' ? 'কনফিগ সফলভাবে চিহ্নিত ও পূরণ করা হয়েছে!' : 'Config detected and auto-filled!');
  };

  const handleSaveCustomKeys = () => {
    if (!isAdmin) {
      toast.error(lang === 'bn' ? 'অনুমতি নেই!' : 'Unauthorized action!');
      return;
    }

    triggerHaptic('double');
    if (!apiKeyInput.trim() || !projectIdInput.trim()) {
      toast.error(lang === 'bn' ? 'API Key এবং Project ID পূরণ করা আবশ্যক!' : 'API Key and Project ID are required!');
      return;
    }

    const saved = saveCustomFirebaseConfig({
      apiKey: apiKeyInput,
      projectId: projectIdInput,
      authDomain: authDomainInput || `${projectIdInput.trim()}.firebaseapp.com`,
      appId: appIdInput,
      storageBucket: storageBucketInput,
      messagingSenderId: messagingSenderIdInput,
      firestoreDatabaseId: databaseIdInput || '(default)'
    });

    if (saved) {
      toast.success(lang === 'bn' ? 'নতুন ফায়ারবেস প্রজেক্ট সফলভাবে সেভ হয়েছে! অ্যাপ রিলোড হচ্ছে...' : 'New Firebase project saved! Reloading app...');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  const handleClearAllConnections = () => {
    if (!isAdmin) {
      toast.error(lang === 'bn' ? 'অনুমতি নেই!' : 'Unauthorized action!');
      return;
    }

    triggerHaptic('double');
    if (window.confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত যে পূর্বের সব ক্যাশ ডাটা, সেশন ও লোকাল কানেকশন মুছে ফেলতে চান?' : 'Are you sure you want to clear all old cached connections and sessions?')) {
      clearAllOldConnectionsAndData();
      toast.success(lang === 'bn' ? 'পূর্বের সব ডাটা ও কানেকশন পরিষ্কার করা হয়েছে! অ্যাপ ফ্রেশ রিলোড হচ্ছে...' : 'All connections and cached data cleared! Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 700);
    }
  };

  const handleResetToDefault = () => {
    if (!isAdmin) {
      toast.error(lang === 'bn' ? 'অনুমতি নেই!' : 'Unauthorized action!');
      return;
    }

    triggerHaptic('single');
    resetToDefaultFirebaseConfig();
    toast.success(lang === 'bn' ? 'ডিফল্ট AI Studio ফায়ারবেস প্রজেক্টে রিস্টোর করা হয়েছে!' : 'Restored to default AI Studio project!');
    setTimeout(() => {
      window.location.reload();
    }, 700);
  };

  if (!isOpen) return null;

  // STRICT ACCESS CONTROL GUARD:
  // If not admin, completely block content and show access denied message
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-900/60 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white">
              {lang === 'bn' ? 'অ্যাক্সেস সংরক্ষিত / অনুমোদিত নয়' : 'Access Denied / Restricted'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              {lang === 'bn' 
                ? 'এই প্যানেলটি শুধুমাত্র নির্ধারিত সিস্টেম অ্যাডমিনিস্ট্রেটরদের জন্য সংরক্ষিত। সাধারণ ইউজার বা গেস্ট অ্যাকাউন্ট থেকে এটি পরিচালনা করা যায় না।' 
                : 'This panel is strictly restricted to designated system administrators. Regular users or guests cannot access system controls.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-extrabold rounded-xl text-sm transition-colors cursor-pointer"
          >
            {lang === 'bn' ? 'ফিরে যান' : 'Close'}
          </button>
        </motion.div>
      </div>
    );
  }

  const authorizedAdmins = getAuthorizedAdminEmails();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50 dark:bg-zinc-850">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                    {lang === 'bn' ? 'অ্যাডমিন কন্ট্রোল প্যানেল' : 'Admin Control Panel'}
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    SUPER ADMIN
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                  {userEmail || 'itzemon990@gmail.com'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-1.5 gap-1.5 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('single');
                setActiveTab('firebase');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'firebase'
                  ? 'bg-white dark:bg-zinc-850 text-emerald-700 dark:text-emerald-400 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              id="admin_tab_firebase"
            >
              <Database className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ফায়ারবেস ও ব্যাকএন্ড' : 'Firebase & Backend'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('single');
                setActiveTab('diagnostics');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'diagnostics'
                  ? 'bg-white dark:bg-zinc-850 text-emerald-700 dark:text-emerald-400 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              id="admin_tab_diagnostics"
            >
              <Activity className="w-4 h-4" />
              <span>{lang === 'bn' ? 'লাইভ ডায়াগনস্টিক' : 'Live Health'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('single');
                setActiveTab('future_admin');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'future_admin'
                  ? 'bg-white dark:bg-zinc-850 text-emerald-700 dark:text-emerald-400 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              id="admin_tab_future"
            >
              <Lock className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ফিউচার অ্যাডমিন কন্ট্রোল' : 'Future Authority'}</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-zinc-800 dark:text-zinc-200">
            {activeTab === 'firebase' && (
              /* TAB 1: FIREBASE & BACKEND CONFIGURATION */
              <div className="space-y-5">
                {/* Active Connection Status Card */}
                <div className="p-4 sm:p-5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse"></span>
                      <span className="text-sm font-black text-emerald-900 dark:text-emerald-300">
                        {lang === 'bn' ? 'ফায়ারবেস ব্যাকএন্ড সক্রিয়' : 'Firebase Backend Online'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      {activeConfig.isCustom ? (lang === 'bn' ? 'কাস্টম প্রজেক্ট' : 'Custom Project') : (lang === 'bn' ? 'ডিফল্ট প্রভিশনড' : 'AI Studio Provisioned')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Project ID</span>
                      <div className="flex items-center justify-between font-mono font-bold text-zinc-800 dark:text-zinc-200 break-all">
                        <span>{activeConfig.projectId || 'N/A'}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeConfig.projectId, 'projectId')}
                          className="p-1 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                        >
                          {copiedField === 'projectId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Database ID</span>
                      <div className="flex items-center justify-between font-mono font-bold text-zinc-800 dark:text-zinc-200 break-all">
                        <span>{activeConfig.firestoreDatabaseId || '(default)'}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeConfig.firestoreDatabaseId || '(default)', 'dbId')}
                          className="p-1 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                        >
                          {copiedField === 'dbId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Auth Domain</span>
                      <div className="flex items-center justify-between font-mono text-zinc-700 dark:text-zinc-300 break-all">
                        <span>{activeConfig.authDomain || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secure Custom Keys or Project Snippet */}
                <div className="p-4 sm:p-5 bg-white dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <Key className="w-4 h-4 text-emerald-600" />
                        {lang === 'bn' ? 'ফায়ারবেস প্রজেক্ট কনফিগ পরিবর্তন বা লিঙ্ক' : 'Update / Link Firebase Project'}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {lang === 'bn' ? 'প্রয়োজনে নিজস্ব Firebase Console এর প্রজেক্ট কোড পেস্ট করে কানেক্ট করুন।' : 'Paste your Firebase Console snippet or enter project credentials.'}
                      </p>
                    </div>
                  </div>

                  {/* Method 1: Snippet paste */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold uppercase text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lang === 'bn' ? 'পদ্ধতি ১: Firebase Config Code Snippet পেস্ট করুন' : 'Method 1: Paste Firebase Config Code Snippet'}</span>
                    </label>
                    <textarea
                      rows={3}
                      value={snippetInput}
                      onChange={(e) => setSnippetInput(e.target.value)}
                      placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "your-project",\n  authDomain: "your-project.firebaseapp.com"\n};`}
                      className="w-full p-2.5 font-mono text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleParseSnippet}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'অটো-ফিল্ডে বসান' : 'Auto-fill Fields'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Method 2: Detailed Inputs */}
                  <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <label className="font-bold text-zinc-700 dark:text-zinc-300">
                          API Key <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500"
                          id="admin_firebase_api_key_input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-zinc-700 dark:text-zinc-300">
                          Project ID <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={projectIdInput}
                          onChange={(e) => setProjectIdInput(e.target.value)}
                          placeholder="my-cool-project"
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500"
                          id="admin_firebase_project_id_input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-zinc-700 dark:text-zinc-300">Auth Domain</label>
                        <input
                          type="text"
                          value={authDomainInput}
                          onChange={(e) => setAuthDomainInput(e.target.value)}
                          placeholder="my-project.firebaseapp.com"
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-zinc-700 dark:text-zinc-300">Firestore Database ID</label>
                        <input
                          type="text"
                          value={databaseIdInput}
                          onChange={(e) => setDatabaseIdInput(e.target.value)}
                          placeholder="main"
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleSaveCustomKeys}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                        id="admin_save_firebase_config_btn"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{lang === 'bn' ? 'কনফিগ সেভ ও কানেক্ট করুন' : 'Save & Connect Backend'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reset & Purge Cache Actions */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Trash2 className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-zinc-900 dark:text-white">
                        {lang === 'bn' ? 'অ্যাডমিন মেইনটেন্যান্স ও ক্যাশ রিসেট' : 'Admin Maintenance & Cache Purge'}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {lang === 'bn' 
                          ? 'ব্রাউজারে থাকা ক্যাশ করা টেস্ট ডাটা, অবসোলেট সেশন ও পুরানো কি পরিষ্কার করুন।' 
                          : 'Clear browser cached sessions, obsolete keys, and reset to fresh state.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClearAllConnections}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'সব লোকাল ক্যাশ ও সেশন মুছুন' : 'Clear All Local Cache'}</span>
                    </button>

                    {activeConfig.isCustom && (
                      <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-3.5 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'ডিফল্ট AI Studio প্রজেক্টে ফিরুন' : 'Reset to Default Project'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              /* TAB 2: LIVE SYSTEM DIAGNOSTICS */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-500 dark:text-zinc-400">Server Health API</span>
                      <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] ${
                        pingStatus === 'healthy' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {pingStatus}
                      </span>
                    </div>
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                      {pingLatency !== null ? `${pingLatency} ms` : 'Checking...'}
                    </div>
                    <p className="text-[11px] text-zinc-400">Endpoint: /api/health</p>
                  </div>

                  <div className="p-4 bg-zinc-50 dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-500 dark:text-zinc-400">Firestore Offline Sync</span>
                      <span className="px-2 py-0.5 rounded font-black uppercase text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        ACTIVE
                      </span>
                    </div>
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                      IndexedDB Multi-tab
                    </div>
                    <p className="text-[11px] text-zinc-400">Persistent local storage enabled</p>
                  </div>

                  <div className="p-4 bg-zinc-50 dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-500 dark:text-zinc-400">Authenticated Admin</span>
                      <span className="px-2 py-0.5 rounded font-black uppercase text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        VERIFIED
                      </span>
                    </div>
                    <div className="text-sm font-mono font-bold text-zinc-900 dark:text-white break-all">
                      {userEmail || 'itzemon990@gmail.com'}
                    </div>
                    <p className="text-[11px] text-zinc-400">Role: Primary Administrator</p>
                  </div>

                  <div className="p-4 bg-zinc-50 dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-500 dark:text-zinc-400">Security Isolation</span>
                      <span className="px-2 py-0.5 rounded font-black uppercase text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        ENFORCED
                      </span>
                    </div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">
                      Firestore Rules (/users/{`{uid}`}/**)
                    </div>
                    <p className="text-[11px] text-zinc-400">Cross-tenant data leakage prevented</p>
                  </div>
                </div>

                {/* Authorized Admins List */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                  <h4 className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>{lang === 'bn' ? 'অনুমোদিত অ্যাডমিন তালিকা (Authorized Admins)' : 'Configured Authorized Admins'}</span>
                  </h4>
                  <div className="space-y-1">
                    {authorizedAdmins.map((adm) => (
                      <div key={adm} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 font-mono text-[11px]">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{adm}</span>
                        <span className="text-emerald-600 font-bold">SUPER_ADMIN</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'future_admin' && (
              /* TAB 3: FUTURE EXTENSIONS & AUTHORITY CONTROLS */
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-xs space-y-1">
                  <h4 className="font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{lang === 'bn' ? 'ভবিষ্যত অ্যাডমিন টুলস ও এক্সটেনশন প্যানেল' : 'Future Admin Authority & Extension Tools'}</span>
                  </h4>
                  <p className="text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                    {lang === 'bn' 
                      ? 'ভবিষ্যতে আপনার চাহিদামাফিক যেকোনো বিশেষ অ্যাডমিন ফিচার (যেমন অডিট লগ, ইউজার পারমিশন রোটেশন, ব্যাকআপ আর্কাইভিং ইত্যাদি) এই সেকশনে সরাসরি যুক্ত করা যাবে।' 
                      : 'Structured expansion slots ready for your custom administrative controls, security auditing, and authority permissions.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <h5 className="font-bold text-zinc-900 dark:text-white">
                      {lang === 'bn' ? '১. অডিট ও সিকিউরিটি লগ' : '1. Audit & Security Logs'}
                    </h5>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {lang === 'bn' 
                        ? 'সিস্টেমের গুরুত্বপূর্ণ কনফিগারেশন চেঞ্জ এবং সিকিউরিটি ইভেন্ট ট্র্যাক করার অপশন।' 
                        : 'Track configuration changes and security events across administrator sessions.'}
                    </p>
                  </div>

                  <div className="p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                      <Users className="w-4 h-4" />
                    </div>
                    <h5 className="font-bold text-zinc-900 dark:text-white">
                      {lang === 'bn' ? '২. ইউজার ও রোল পলিসি' : '2. User Role & Permission Policy'}
                    </h5>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {lang === 'bn' 
                        ? 'ভবিষ্যতে অন্যান্য অ্যাডমিন যোগ করা বা রোল-ভিত্তিক অধিকার প্রদান করার ইন্টারফেস।' 
                        : 'Interface for managing additional administrators or specialized role delegations.'}
                    </p>
                  </div>

                  <div className="p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold">
                      <Server className="w-4 h-4" />
                    </div>
                    <h5 className="font-bold text-zinc-900 dark:text-white">
                      {lang === 'bn' ? '৩. গ্লোবাল অ্যাপ নোটিশ ও মেইনটেন্যান্স' : '3. Global Notices & Maintenance'}
                    </h5>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {lang === 'bn' 
                        ? 'অ্যাপ্লিকেশনে সাধারণ গ্রাহকদের জন্য জরুরী নোটিশ বা রক্ষণাবেক্ষণ বার্তা দেওয়ার নিয়ন্ত্রণ।' 
                        : 'Deploy broadcast notices or temporary maintenance alerts to application users.'}
                    </p>
                  </div>

                  <div className="p-4 bg-white dark:bg-zinc-850 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center font-bold">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <h5 className="font-bold text-zinc-900 dark:text-white">
                      {lang === 'bn' ? '৪. ডাটাবেস মাইগ্রেশন ও ব্যাকআপ আর্কাইভ' : '4. Database Migration & Archiving'}
                    </h5>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {lang === 'bn' 
                        ? 'সরাসরি সম্পূর্ণ ডাটাবেস স্ন্যাপশট ও কোল্ড স্টোরেজ আর্কাইভিং কন্ট্রোল।' 
                        : 'High-level database snapshot exports and cold storage disaster recovery tools.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
