import React, { useMemo, useState } from 'react';
import { Customer, Transaction } from '../types';
import { 
  TrendingUp, Users, ClipboardList, ArrowUpRight, ArrowDownLeft, ArrowRight,
  Target, Pencil, CheckCircle2, Trophy, Check, X, BarChart3, ChevronRight, Zap,
  LineChart, Calendar
} from 'lucide-react';
import MonthlySummaryCard from './MonthlySummaryCard';
import { translations, formatNumber, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import AnalyticsManager from './AnalyticsManager';
import GeminiInsightsView from './GeminiInsightsView';

const parseFirestoreDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const PRESET_GOALS = [2000, 5000, 10000, 20000, 50000, 100000];

interface DashboardProps {
  customers: Customer[];
  transactions: Transaction[];
  onOpenQuickEntry: () => void;
  onSelectCustomer: (id: string) => void;
  lang: Language;
  onViewDailyTxs: () => void;
  dailyTarget?: number;
  onUpdateDailyTarget?: (target: number) => Promise<void>;
}

export default function Dashboard({
  customers,
  transactions,
  onOpenQuickEntry,
  onSelectCustomer,
  lang,
  onViewDailyTxs,
  dailyTarget = 5000,
  onUpdateDailyTarget
}: DashboardProps) {
  const t = translations[lang];

  // View state: overview vs insights
  const [activeView, setActiveView] = useState<'overview' | 'insights'>('overview');

  // Automated Monthly Summary state (start of each month = first 7 days)
  const isStartOfMonth = useMemo(() => new Date().getDate() <= 7, []);
  const monthlyDismissKey = useMemo(() => {
    const prevDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    return `takatrek_monthly_summary_dismissed_${prevDate.getFullYear()}_${prevDate.getMonth()}`;
  }, []);

  const [isMonthlyDismissed, setIsMonthlyDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(monthlyDismissKey) === 'true';
  });

  const [isMonthlyManuallyOpen, setIsMonthlyManuallyOpen] = useState<boolean>(false);

  const isMonthlySummaryVisible = isMonthlyManuallyOpen || (isStartOfMonth && !isMonthlyDismissed);

  const handleDismissMonthlySummary = () => {
    triggerHaptic('tick');
    setIsMonthlyDismissed(true);
    setIsMonthlyManuallyOpen(false);
    try {
      localStorage.setItem(monthlyDismissKey, 'true');
    } catch (e) {}
    toast.success(lang === 'bn' ? 'এই মাসের জন্য সারসংক্ষেপ লুকানো হয়েছে' : 'Monthly summary dismissed for this month');
  };

  // Target editing state
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(dailyTarget.toString());
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingDue > 0 ? c.outstandingDue : 0), 0);
    const activeDebtorsCount = customers.filter(c => c.outstandingDue > 0).length;
    const totalOverpaid = customers.reduce((sum, c) => sum + (c.outstandingDue < 0 ? Math.abs(c.outstandingDue) : 0), 0);
    const activeCreditorsCount = customers.filter(c => c.outstandingDue < 0).length;

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const todayTxs = transactions.filter(tx => {
      const txDate = parseFirestoreDate(tx.date);
      return txDate >= midnight;
    });

    const duesToday = todayTxs
      .filter(tx => tx.type === 'due')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const paymentsToday = todayTxs
      .filter(tx => tx.type === 'payment')
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      totalOutstanding,
      activeDebtorsCount,
      totalOverpaid,
      activeCreditorsCount,
      duesToday,
      paymentsToday,
      todayTxs
    };
  }, [customers, transactions]);

  // Payment capture percentage for collection efficiency ring
  const paymentRatio = useMemo(() => {
    const totalActiveActions = stats.duesToday + stats.paymentsToday;
    if (totalActiveActions === 0) return 0;
    return Math.round((stats.paymentsToday / totalActiveActions) * 100);
  }, [stats]);

  // Daily target calculations
  const effectiveTarget = dailyTarget > 0 ? dailyTarget : 5000;
  const targetPercent = useMemo(() => {
    if (effectiveTarget <= 0) return 0;
    return Math.round((stats.paymentsToday / effectiveTarget) * 100);
  }, [stats.paymentsToday, effectiveTarget]);

  const isTargetReached = stats.paymentsToday >= effectiveTarget;
  const remainingToGoal = Math.max(0, effectiveTarget - stats.paymentsToday);

  // Handle saving target
  const handleSaveTarget = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(targetInput.replace(/,/g, '').trim());
    if (isNaN(parsed) || parsed <= 0) {
      toast.error(lang === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন' : 'Please enter a valid target amount');
      return;
    }

    try {
      setIsSavingTarget(true);
      triggerHaptic('single');
      if (onUpdateDailyTarget) {
        await onUpdateDailyTarget(parsed);
      }
      setIsEditingTarget(false);
      toast.success(t.targetUpdated);
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'লক্ষ্য সংরক্ষণ করা যায়নি' : 'Failed to save daily target');
    } finally {
      setIsSavingTarget(false);
    }
  };

  return (
    <div className="space-y-6 no-select animate-reveal">
      {/* VIEW SWITCHER: OVERVIEW vs GEMINI AI INSIGHTS */}
      <div className="flex items-center justify-between gap-2 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xs">
        <button
          type="button"
          id="dash_overview_tab_btn"
          onClick={() => {
            triggerHaptic('tick');
            setActiveView('overview');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeView === 'overview'
              ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{t.overviewTab}</span>
        </button>

        <button
          type="button"
          id="dash_insights_tab_btn"
          onClick={() => {
            triggerHaptic('single');
            setActiveView('insights');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeView === 'insights'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <LineChart className="w-4 h-4" />
          <span>{t.insightsTab}</span>
        </button>
      </div>

      {activeView === 'insights' ? (
        <GeminiInsightsView 
          customers={customers}
          transactions={transactions}
          lang={lang}
          onSelectCustomer={onSelectCustomer}
        />
      ) : (
        <div className="space-y-6">
          {/* AUTOMATED PREVIOUS MONTH SUMMARY BANNER / CARD */}
          <MonthlySummaryCard 
            transactions={transactions}
            customers={customers}
            lang={lang}
            onSelectCustomer={onSelectCustomer}
            isOpen={isMonthlySummaryVisible}
            onClose={handleDismissMonthlySummary}
            isAutoPrompt={isStartOfMonth && !isMonthlyDismissed}
          />

          {!isMonthlySummaryVisible && (
            <div className="flex justify-end">
              <button
                type="button"
                id="view_monthly_summary_trigger_btn"
                onClick={() => {
                  triggerHaptic('tick');
                  setIsMonthlyManuallyOpen(true);
                }}
                className="py-2 px-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t.showPastSummary}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. MAIN OUTSTANDING LEDGER HERO (GIANT CLEAR NUMBERS) */}
      <div 
        className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 bg-zinc-400/5 dark:bg-white/5 w-64 h-64 rounded-full blur-2xl"></div>
        
        <div className="space-y-1 relative z-10">
          <span className="text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
            {t.totalOutstanding}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white">
              ৳ {formatNumber(stats.totalOutstanding, lang)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase">{lang === 'bn' ? 'বকেয়া' : 'collectible'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t-2 border-dotted border-zinc-300 dark:border-zinc-700 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/50 text-amber-600 dark:text-amber-500">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                {formatNumber(stats.activeDebtorsCount, lang)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.debtorsCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">
                {formatNumber(transactions.length, lang)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.totalTransactions}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TODAY'S TOTALS (DASHBOARD AT A GLANCE) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dues Added Today card */}
        <div 
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-md flex items-center justify-between transition-transform"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">{t.duesToday}</span>
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-450">
              ৳ {formatNumber(stats.duesToday, lang)}
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{lang === 'bn' ? 'আজকের বাকি প্রদান' : 'Credit sales logged'}</span>
          </div>
          <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-2xl text-rose-500">
            <ArrowUpRight className="w-8 h-8 stroke-[2.5]" />
          </div>
        </div>

        {/* Payments Collected Today card */}
        <div 
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-md flex items-center justify-between transition-transform"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">{t.paymentsToday}</span>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              ৳ {formatNumber(stats.paymentsToday, lang)}
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{lang === 'bn' ? 'আজকের পেমেন্ট গ্রহণ' : 'Cash/UPI collected'}</span>
          </div>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl text-emerald-500">
            <ArrowDownLeft className="w-8 h-8 stroke-[2.5]" />
          </div>
        </div>

        {/* Collection Efficiency Ring */}
        <div 
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-md flex items-center gap-4 transition-transform"
        >
          {/* Circular progress */}
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="currentColor" fill="none" strokeWidth="8" className="text-gray-100 dark:text-zinc-850" />
              <circle cx="40" cy="40" r="32" stroke="currentColor" fill="none" strokeWidth="8" 
                strokeDasharray={200}
                strokeDashoffset={200 - (200 * (stats.duesToday === 0 && stats.paymentsToday === 0 ? 0 : paymentRatio)) / 100}
                className="text-emerald-500 dark:text-emerald-400 transition-all duration-500 stroke-linecap-round" 
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-sm font-bold text-zinc-850 dark:text-zinc-100">
                {formatNumber(paymentRatio, lang)}%
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t.efficiency}</div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {stats.duesToday === 0 && stats.paymentsToday === 0 
                ? (lang === 'bn' ? 'আজকের কাজ খালি' : 'No transactions today')
                : (lang === 'bn' ? 'মোট লেনদেনে উসুল পেমেন্ট হার' : t.efficiencyDesc)}
            </p>
          </div>
        </div>
      </div>

      {/* 3. DAILY COLLECTION TARGET & PROGRESS BAR */}
      <div 
        id="daily_collection_target_card"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden transition-all"
      >
        {/* Header with Title, Goal Achieved Badge and Edit Button */}
        <div className="flex items-start sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl shadow-sm ${
              isTargetReached 
                ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                : 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
            }`}>
              {isTargetReached ? (
                <Trophy className="w-6 h-6 stroke-[2.5]" />
              ) : (
                <Target className="w-6 h-6 stroke-[2.5]" />
              )}
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                  {t.dailyTarget}
                </h3>
                {isTargetReached && (
                  <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'লক্ষ্য পূরণ!' : 'Goal Achieved!'}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t.dailyTargetDesc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('single');
              setTargetInput(effectiveTarget.toString());
              setIsEditingTarget(true);
            }}
            className="shrink-0 flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer border border-zinc-200/80 dark:border-zinc-700/80"
            id="edit_daily_target_button"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{t.editTarget}</span>
          </button>
        </div>

        {/* Target Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl p-4">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
              {t.collectedSoFar}
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ৳ {formatNumber(stats.paymentsToday, lang)}
            </div>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {lang === 'bn' ? 'আজকের মোট পেমেন্ট' : "Today's payments"}
            </span>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl p-4">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
              {t.targetGoal}
            </span>
            <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
              ৳ {formatNumber(effectiveTarget, lang)}
            </div>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {lang === 'bn' ? 'দৈনিক লক্ষ্যমাত্রা' : 'Target for the day'}
            </span>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl p-4">
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
              {lang === 'bn' ? 'লক্ষ্য অর্জন' : 'Goal Completion'}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${
                isTargetReached ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'
              }`}>
                {formatNumber(targetPercent, lang)}%
              </span>
              {isTargetReached && (
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {stats.paymentsToday > effectiveTarget ? `+৳${formatNumber(stats.paymentsToday - effectiveTarget, lang)}` : '✓'}
                </span>
              )}
            </div>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate block">
              {isTargetReached 
                ? (lang === 'bn' ? 'লক্ষ্য পূরণ হয়েছে' : 'Target achieved') 
                : (lang === 'bn' ? `আরও ৳ ${formatNumber(remainingToGoal, lang)} প্রয়োজন` : `৳ ${formatNumber(remainingToGoal, lang)} to go`)}
            </span>
          </div>
        </div>

        {/* Solid Signature Green Progress Bar */}
        <div className="mt-5 space-y-2.5">
          <div className="relative w-full h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-200/60 dark:border-zinc-700/60">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, targetPercent)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
            />
          </div>

          {/* Progress Subtitle & Visual Milestones */}
          <div className="flex items-center justify-between text-xs font-bold pt-0.5">
            <div className={`flex items-center gap-1.5 ${
              isTargetReached 
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
                : 'text-zinc-600 dark:text-zinc-300'
            }`}>
              {isTargetReached ? (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {t.goalAchieved} {stats.paymentsToday > effectiveTarget && `(৳${formatNumber(stats.paymentsToday - effectiveTarget, lang)} ${lang === 'bn' ? 'অতিরিক্ত' : 'surplus'})`}
                  </span>
                </>
              ) : (
                <span>
                  {t.remainingToGoal}: <span className="text-zinc-900 dark:text-white font-black">৳ {formatNumber(remainingToGoal, lang)}</span>
                </span>
              )}
            </div>

            <div className="text-zinc-400 dark:text-zinc-500 font-extrabold">
              {formatNumber(stats.paymentsToday, lang)} / {formatNumber(effectiveTarget, lang)} ৳
            </div>
          </div>
        </div>
      </div>

      {/* 4. TODAY'S RECENT JOURNAL RECORDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
            {t.quickBook} ({formatNumber(stats.todayTxs.length, lang)})
          </span>
          <button 
            onClick={onOpenQuickEntry}
            className="text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-1.5 rounded-full cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
            id="add_now_dash_btn"
          >
            + {t.recordEntry}
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-md">
          {stats.todayTxs.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 flex flex-col items-center gap-3">
              <ClipboardList className="w-12 h-12 stroke-[1.5]" />
              <div>
                <p className="font-bold text-base text-zinc-700 dark:text-zinc-300">{t.noActivity}</p>
                <p className="text-xs mt-1">{t.recentPayments}</p>
              </div>
              <button
                type="button"
                onClick={onViewDailyTxs}
                className="mt-2 px-4 py-2 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-xl transition-colors cursor-pointer border border-emerald-250 dark:border-emerald-800"
              >
                {lang === 'bn' ? 'পুরানো বকেয়া ও আদায় দেখতে চান?' : 'Want to view older dues and payments?'}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {stats.todayTxs.slice(0, 5).map(tx => (
                <div 
                  key={tx.id}
                  onClick={() => onSelectCustomer(tx.customerId)}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-3 rounded-xl shrink-0 ${
                      tx.type === 'due' 
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450' 
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {tx.type === 'due' ? <ArrowUpRight className="w-5 h-5 stroke-[2.5]" /> : <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold text-zinc-800 dark:text-zinc-100 truncate">{tx.customerName}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 animate-pulse-once">
                        {tx.description || (tx.type === 'due' ? t.dueTrigger : t.paymentTrigger)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-base sm:text-lg font-black ${
                      tx.type === 'due' ? 'text-rose-600 dark:text-rose-450' : 'text-emerald-600 dark:text-emerald-450'
                    }`}>
                      {tx.type === 'due' ? '+' : '-'} ৳ {formatNumber(tx.amount, lang)}
                    </div>
                    <div className="text-2xs text-zinc-400 dark:text-zinc-500 font-bold uppercase mt-0.5">
                      {new Date(parseFirestoreDate(tx.date)).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {stats.todayTxs.length > 0 && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-850/50 flex justify-center">
                  <button 
                    onClick={onViewDailyTxs}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {lang === 'bn' ? 'আজকের সব লেনদেন দেখুন' : 'View All Daily Transactions'} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. INTEGRATED MONTHLY ANALYTICS REPORT */}
      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/50">
        <AnalyticsManager 
          customers={customers}
          transactions={transactions}
          lang={lang}
        />
      </div>
    </div>
    )}

      {/* 6. SET / EDIT DAILY TARGET MODAL */}
      <AnimatePresence>
        {isEditingTarget && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                    <Target className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                      {t.setTarget}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t.dailyTargetDesc}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingTarget(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTarget} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    {t.enterTargetAmount}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-zinc-400">
                      ৳
                    </span>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      placeholder="5000"
                      autoFocus
                      required
                      className="w-full pl-9 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-2xl text-xl font-black text-zinc-900 dark:text-white focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Quick Preset Buttons */}
                <div>
                  <span className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 mb-2">
                    {t.quickPresets}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_GOALS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          setTargetInput(preset.toString());
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                          targetInput === preset.toString()
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-750'
                        }`}
                      >
                        ৳ {formatNumber(preset, lang)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditingTarget(false)}
                    className="flex-1 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-sm cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTarget}
                    className="flex-1 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{isSavingTarget ? t.saving : t.saveGoal}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
