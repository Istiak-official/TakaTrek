import React, { useMemo, useState } from 'react';
import { Customer, Transaction } from '../types';
import { 
  Calendar, FileDown, Table, ChevronDown, ChevronUp, X, 
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
  Layers, Users, CheckCircle2, AlertCircle, Eye
} from 'lucide-react';
import { translations, formatNumber, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { exportMonthlyTransactionsToCSV, exportMonthlyTransactionsToPDF } from '../lib/exportUtils';

const parseFirestoreDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

interface MonthlySummaryCardProps {
  transactions: Transaction[];
  customers: Customer[];
  lang: Language;
  onSelectCustomer: (customerId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isAutoPrompt?: boolean;
}

export default function MonthlySummaryCard({
  transactions,
  customers,
  lang,
  onSelectCustomer,
  isOpen,
  onClose,
  isAutoPrompt = false
}: MonthlySummaryCardProps) {
  const t = translations[lang];

  // Date boundaries for Previous Month (M-1) and Prior Month (M-2)
  const dateBoundaries = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Previous month (M-1)
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();
    const startOfPrevMonth = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0);
    const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

    // Prior month (M-2)
    const priorDate = new Date(currentYear, currentMonth - 2, 1);
    const priorYear = priorDate.getFullYear();
    const priorMonth = priorDate.getMonth();
    const startOfPriorMonth = new Date(priorYear, priorMonth, 1, 0, 0, 0, 0);
    const endOfPriorMonth = new Date(priorYear, priorMonth + 1, 0, 23, 59, 59, 999);

    const formatter = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'long',
      year: 'numeric'
    });

    return {
      prevYear,
      prevMonth,
      startOfPrevMonth,
      endOfPrevMonth,
      prevMonthName: formatter.format(prevDate),
      priorYear,
      priorMonth,
      startOfPriorMonth,
      endOfPriorMonth,
      priorMonthName: formatter.format(priorDate)
    };
  }, [lang]);

  // Expandable breakdown drawer state
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Filter Previous Month Transactions
  const prevMonthTxs = useMemo(() => {
    return transactions.filter(tx => {
      const d = parseFirestoreDate(tx.date);
      return d >= dateBoundaries.startOfPrevMonth && d <= dateBoundaries.endOfPrevMonth;
    });
  }, [transactions, dateBoundaries]);

  // Filter Prior Month Transactions (for MoM comparison)
  const priorMonthTxs = useMemo(() => {
    return transactions.filter(tx => {
      const d = parseFirestoreDate(tx.date);
      return d >= dateBoundaries.startOfPriorMonth && d <= dateBoundaries.endOfPriorMonth;
    });
  }, [transactions, dateBoundaries]);

  // Aggregate Previous Month Metrics
  const prevStats = useMemo(() => {
    const dues = prevMonthTxs
      .filter(t => t.type === 'due')
      .reduce((sum, t) => sum + t.amount, 0);
    const collections = prevMonthTxs
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);
    const netBalance = collections - dues; // positive = Cash Surplus, negative = Credit Deficit

    return {
      dues,
      collections,
      netBalance,
      txCount: prevMonthTxs.length
    };
  }, [prevMonthTxs]);

  // Aggregate Prior Month Metrics for percentage comparison
  const priorStats = useMemo(() => {
    const dues = priorMonthTxs
      .filter(t => t.type === 'due')
      .reduce((sum, t) => sum + t.amount, 0);
    const collections = priorMonthTxs
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      dues,
      collections
    };
  }, [priorMonthTxs]);

  // Calculate percentage change
  const calcPctChange = (current: number, prior: number): { pct: number; isUp: boolean; isNeutral: boolean } => {
    if (prior === 0) {
      if (current === 0) return { pct: 0, isUp: false, isNeutral: true };
      return { pct: 100, isUp: true, isNeutral: false };
    }
    const diff = current - prior;
    const pct = Math.round(Math.abs(diff / prior) * 100);
    return {
      pct,
      isUp: diff > 0,
      isNeutral: diff === 0
    };
  };

  const duesMoM = useMemo(() => calcPctChange(prevStats.dues, priorStats.dues), [prevStats.dues, priorStats.dues]);
  const collectionsMoM = useMemo(() => calcPctChange(prevStats.collections, priorStats.collections), [prevStats.collections, priorStats.collections]);

  // Top Customer Movements in Previous Month
  const customerBreakdown = useMemo(() => {
    const map: Record<string, { customerId: string; customerName: string; totalPaid: number; totalDue: number; phone?: string }> = {};

    prevMonthTxs.forEach(tx => {
      if (!map[tx.customerId]) {
        const found = customers.find(c => c.id === tx.customerId);
        map[tx.customerId] = {
          customerId: tx.customerId,
          customerName: tx.customerName || found?.name || (lang === 'bn' ? 'গ্রাহক' : 'Customer'),
          phone: found?.phone,
          totalPaid: 0,
          totalDue: 0
        };
      }
      if (tx.type === 'payment') {
        map[tx.customerId].totalPaid += tx.amount;
      } else {
        map[tx.customerId].totalDue += tx.amount;
      }
    });

    return Object.values(map)
      .sort((a, b) => (b.totalPaid + b.totalDue) - (a.totalPaid + a.totalDue))
      .slice(0, 6);
  }, [prevMonthTxs, customers, lang]);

  // PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      triggerHaptic('single');
      await exportMonthlyTransactionsToPDF({
        monthName: dateBoundaries.prevMonthName,
        year: dateBoundaries.prevYear,
        month: dateBoundaries.prevMonth,
        transactions: prevMonthTxs,
        lang,
        totalDues: prevStats.dues,
        totalCollections: prevStats.collections,
        netBalance: prevStats.netBalance
      });
      toast.success(lang === 'bn' ? 'মাসিক পিডিএফ স্টেটমেন্ট ডাউনলোড হয়েছে' : 'Monthly PDF statement downloaded');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'পিডিএফ তৈরি ব্যর্থ হয়েছে' : 'Failed to generate PDF statement');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    try {
      triggerHaptic('single');
      exportMonthlyTransactionsToCSV({
        monthName: dateBoundaries.prevMonthName,
        year: dateBoundaries.prevYear,
        month: dateBoundaries.prevMonth,
        transactions: prevMonthTxs,
        lang,
        totalDues: prevStats.dues,
        totalCollections: prevStats.collections,
        netBalance: prevStats.netBalance
      });
      toast.success(lang === 'bn' ? 'সিএসভি ফাইল ডাউনলোড হয়েছে' : 'CSV file exported successfully');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'সিএসভি তৈরি ব্যর্থ হয়েছে' : 'Failed to export CSV');
    }
  };

  if (!isOpen) return null;

  const isSurplus = prevStats.netBalance >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      id="monthly_summary_card"
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-lg relative overflow-hidden"
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Calendar className="w-5 h-5 stroke-[2.5] text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                {t.monthlySummaryTitle}
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                {dateBoundaries.prevMonthName}
              </span>
              {isAutoPrompt && (
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                  {lang === 'bn' ? '• মাসের ১ম সপ্তাহের স্বয়ংক্রিয় হিসাব' : '• First-week automatic report'}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t.monthlySummarySubtitle}
            </p>
          </div>
        </div>

        {/* Action Controls: Export Buttons & Dismiss */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={prevMonthTxs.length === 0}
            title={t.downloadCsvReport}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Table className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">CSV</span>
          </button>

          {/* PDF Export */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf || prevMonthTxs.length === 0}
            title={t.downloadPdfStatement}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? (lang === 'bn' ? 'তৈরি...' : 'PDF...') : 'PDF'}</span>
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={onClose}
            title={t.dismissMonthlySummary}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label={t.dismissMonthlySummary}
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Main 3 Metrics Grid: Dues, Collections, Net Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mt-5">
        {/* 1. Collections Card */}
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
              {t.cashCollected}
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
              ৳ {formatNumber(prevStats.collections, lang)}
            </div>

            {/* Prior Month Comparison */}
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {!collectionsMoM.isNeutral ? (
                <span className={`inline-flex items-center gap-0.5 font-bold font-mono ${
                  collectionsMoM.isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {collectionsMoM.isUp ? (
                    <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  {collectionsMoM.isUp ? '+' : '-'}{collectionsMoM.pct}%
                </span>
              ) : (
                <span className="font-bold text-zinc-400 font-mono">0%</span>
              )}
              <span className="text-[11px] text-zinc-600 dark:text-zinc-300">
                {t.vsPriorMonth} ({dateBoundaries.priorMonthName})
              </span>
            </div>
          </div>
        </div>

        {/* 2. Dues Card */}
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
              {t.duesExtended}
            </span>
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-450 font-mono tabular-nums tracking-tight">
              ৳ {formatNumber(prevStats.dues, lang)}
            </div>

            {/* Prior Month Comparison */}
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {!duesMoM.isNeutral ? (
                <span className={`inline-flex items-center gap-0.5 font-bold font-mono ${
                  duesMoM.isUp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {duesMoM.isUp ? (
                    <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  {duesMoM.isUp ? '+' : '-'}{duesMoM.pct}%
                </span>
              ) : (
                <span className="font-bold text-zinc-400 font-mono">0%</span>
              )}
              <span className="text-[11px] text-zinc-600 dark:text-zinc-300">
                {t.vsPriorMonth} ({dateBoundaries.priorMonthName})
              </span>
            </div>
          </div>
        </div>

        {/* 3. Net Balance Card */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
          isSurplus 
            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/50' 
            : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-bold ${
              isSurplus ? 'text-blue-900 dark:text-blue-300' : 'text-amber-900 dark:text-amber-300'
            }`}>
              {t.netCashBalance}
            </span>
            <div className={`p-2 rounded-xl shrink-0 ${
              isSurplus 
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' 
                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300'
            }`}>
              <Layers className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className={`text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tight ${
              isSurplus ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-400'
            }`}>
              {isSurplus ? '+' : ''}৳ {formatNumber(prevStats.netBalance, lang)}
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-xs">
              <span className={`font-bold ${
                isSurplus ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-400'
              }`}>
                {isSurplus ? t.netSurplus : t.netDeficit}
              </span>
              <span className="text-[11px] text-zinc-600 dark:text-zinc-300">
                • {formatNumber(prevStats.txCount, lang)} {lang === 'bn' ? 'টি লেনদেন' : 'records'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Expandable Customer Breakdown */}
      <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('tick');
            setShowBreakdown(!showBreakdown);
          }}
          className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-bold flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {showBreakdown ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>{t.hideBreakdown}</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              <span>{t.viewBreakdown} ({formatNumber(customerBreakdown.length, lang)} {lang === 'bn' ? 'জন গ্রাহক' : 'customers'})</span>
            </>
          )}
        </button>

        <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
          <span>{dateBoundaries.prevMonthName} • {formatNumber(prevMonthTxs.length, lang)} {lang === 'bn' ? 'টি মোট লেনদেন' : 'total transactions'}</span>
        </div>
      </div>

      {/* Expandable Customer Details Drawer */}
      <AnimatePresence>
        {showBreakdown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-3"
          >
            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{t.topCustomerActivity} ({dateBoundaries.prevMonthName})</span>
                </span>
                <span className="text-[11px] text-zinc-400">
                  {lang === 'bn' ? 'প্রোফাইল দেখতে ক্লিক করুন' : 'Click to view customer profile'}
                </span>
              </div>

              {customerBreakdown.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  {t.noTransactionsInMonth}
                </div>
              ) : (
                <div className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                  {customerBreakdown.map((item, idx) => (
                    <div
                      key={item.customerId || idx}
                      onClick={() => {
                        triggerHaptic('tick');
                        onSelectCustomer(item.customerId);
                      }}
                      className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[11px] font-mono font-bold text-zinc-400 w-5 shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {item.customerName}
                          </span>
                          {item.phone && (
                            <span className="text-[10px] text-zinc-400 font-mono block">
                              {item.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
                        {item.totalPaid > 0 && (
                          <div className="text-right">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
                              {lang === 'bn' ? 'আদায়' : 'Paid'}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                              ৳ {formatNumber(item.totalPaid, lang)}
                            </span>
                          </div>
                        )}

                        {item.totalDue > 0 && (
                          <div className="text-right">
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">
                              {lang === 'bn' ? 'বাকি' : 'Due'}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-450 font-mono tabular-nums">
                              ৳ {formatNumber(item.totalDue, lang)}
                            </span>
                          </div>
                        )}

                        <Eye className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 dark:group-hover:text-zinc-300 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
