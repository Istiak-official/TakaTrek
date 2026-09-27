import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, Transaction } from '../types';
import { 
  LineChart, TrendingUp, AlertTriangle, Lightbulb, ShieldCheck, 
  RefreshCw, CheckCircle2, ChevronRight, Zap, ArrowUpRight, ArrowDownLeft,
  Calendar, Layers, Check, Loader2, Info
} from 'lucide-react';
import { translations, formatNumber, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface SpendingPattern {
  title: string;
  description: string;
  patternType: 'positive' | 'warning' | 'neutral' | string;
  impactMetric?: string;
}

interface SavingsSuggestion {
  title: string;
  category: string;
  potentialSavings: string;
  actionPlan: string;
}

interface UnusualSpike {
  title: string;
  date?: string;
  customerName: string;
  amount: string;
  spikeType: 'due_spike' | 'payment_spike' | 'anomaly' | string;
  severity: 'high' | 'medium' | 'low' | string;
  explanation: string;
  recommendation: string;
}

interface InsightsData {
  healthScore: number;
  healthStatus: string;
  summary: string;
  spendingPatterns: SpendingPattern[];
  savingsSuggestions: SavingsSuggestion[];
  unusualSpikes: UnusualSpike[];
  actionableTips: string[];
}

interface GeminiInsightsViewProps {
  customers: Customer[];
  transactions: Transaction[];
  lang: Language;
  onSelectCustomer?: (id: string) => void;
}

const parseFirestoreDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds !== undefined) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export default function GeminiInsightsView({
  customers,
  transactions,
  lang,
  onSelectCustomer
}: GeminiInsightsViewProps) {
  const t = translations[lang];

  // Helper for available months
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthKey);

    transactions.forEach(tx => {
      const d = parseFirestoreDate(tx.date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthsSet.add(key);
      }
    });

    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const [selectedMonth, setSelectedMonth] = useState<string>(availableMonths[0] || '');
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastAnalyzedMonth, setLastAnalyzedMonth] = useState<string | null>(null);
  const [insightsSource, setInsightsSource] = useState<'gemini' | 'statistical_baseline' | null>(null);

  // Month Name Formatter
  const toBnNum = (n: string | number) =>
    n.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);

  const getMonthName = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, monthStr] = monthKey.split('-');
    const monthIndex = parseInt(monthStr, 10) - 1;
    const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const bnMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    const mName = lang === 'bn' ? bnMonths[monthIndex] : enMonths[monthIndex];
    const yName = lang === 'bn' ? toBnNum(year) : year;
    return `${mName} ${yName}`;
  };

  // Extract selected month metrics
  const monthData = useMemo(() => {
    if (!selectedMonth) return { dues: 0, payments: 0, efficiency: 0, txs: [], topDebtors: [], topPayers: [], dayActivity: [] };
    const [year, month] = selectedMonth.split('-').map(Number);
    
    let dues = 0;
    let payments = 0;
    const monthTxs: any[] = [];
    const payerMap: Record<string, { customerId: string; name: string; total: number }> = {};
    const dayMap: Record<number, { day: number; dues: number; payments: number; count: number }> = {};

    transactions.forEach(tx => {
      const d = parseFirestoreDate(tx.date);
      if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
        monthTxs.push({
          id: tx.id,
          date: d.toISOString(),
          customerName: tx.customerName,
          customerId: tx.customerId,
          type: tx.type,
          amount: tx.amount,
          description: tx.description || '',
          tag: tx.tag || ''
        });

        const dayNum = d.getDate();
        if (!dayMap[dayNum]) dayMap[dayNum] = { day: dayNum, dues: 0, payments: 0, count: 0 };
        dayMap[dayNum].count++;

        if (tx.type === 'due') {
          dues += tx.amount;
          dayMap[dayNum].dues += tx.amount;
        } else if (tx.type === 'payment') {
          payments += tx.amount;
          dayMap[dayNum].payments += tx.amount;
          if (!payerMap[tx.customerId]) {
            payerMap[tx.customerId] = { customerId: tx.customerId, name: tx.customerName, total: 0 };
          }
          payerMap[tx.customerId].total += tx.amount;
        }
      }
    });

    const efficiency = dues > 0 ? Math.round((payments / dues) * 100) : payments > 0 ? 100 : 0;
    
    const topDebtors = [...customers]
      .filter(c => c.outstandingDue > 0)
      .sort((a, b) => b.outstandingDue - a.outstandingDue)
      .slice(0, 5)
      .map(c => ({ customerId: c.id, name: c.name, outstandingDue: c.outstandingDue }));

    const topPayers = Object.values(payerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const dayActivity = Object.values(dayMap).sort((a, b) => a.day - b.day);

    return {
      dues,
      payments,
      efficiency,
      txs: monthTxs,
      topDebtors,
      topPayers,
      dayActivity
    };
  }, [selectedMonth, transactions, customers]);

  // Analyze via Gemini API endpoint
  const runAnalysis = useCallback(async (force = false) => {
    if (!selectedMonth) return;
    
    // Check cached session data unless forced
    const cacheKey = `gemini_insights_${selectedMonth}_${lang}`;
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setInsights(parsed.insights);
          setInsightsSource(parsed.source || 'gemini');
          setLastAnalyzedMonth(selectedMonth);
          return;
        } catch {
          // ignore cache parse error
        }
      }
    }

    try {
      setLoading(true);
      triggerHaptic('single');

      const payload = {
        month: getMonthName(selectedMonth),
        lang,
        metrics: {
          dues: monthData.dues,
          payments: monthData.payments,
          efficiency: monthData.efficiency
        },
        transactions: monthData.txs,
        topDebtors: monthData.topDebtors,
        topPayers: monthData.topPayers,
        dayByDayActivity: monthData.dayActivity
      };

      const response = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data && data.insights) {
        setInsights(data.insights);
        setInsightsSource(data.source || 'gemini');
        setLastAnalyzedMonth(selectedMonth);
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        toast.success(t.insightsReady);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err: any) {
      console.error('Failed to run Gemini analysis:', err);
      toast.error(t.insightsFailed);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, lang, monthData, t.insightsReady, t.insightsFailed]);

  // Automatically analyze when month or component loads
  useEffect(() => {
    if (selectedMonth && (!insights || lastAnalyzedMonth !== selectedMonth)) {
      runAnalysis(false);
    }
  }, [selectedMonth, runAnalysis, lastAnalyzedMonth, insights]);

  // Color mappings for Health Score
  const getScoreColor = (score: number) => {
    if (score >= 80) return { bg: 'text-emerald-500', border: 'border-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' };
    if (score >= 60) return { bg: 'text-amber-500', border: 'border-amber-500', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
    return { bg: 'text-rose-500', border: 'border-rose-500', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' };
  };

  const scoreTheme = insights ? getScoreColor(insights.healthScore) : getScoreColor(70);

  return (
    <div className="space-y-6 animate-reveal">
      {/* ── TOP CONTROL BAR ────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <LineChart className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                {t.poweredByGemini}
              </span>
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white">
              {t.aiInsights}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium max-w-2xl mt-1">
              {t.aiInsightsDesc}
            </p>
          </div>

          {/* Month selector & Analyze button */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="relative">
              <select
                id="insights_month_select"
                aria-label={t.selectMonthToAnalyze}
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value);
                  triggerHaptic('tick');
                }}
                className="bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-2.5 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs pr-9 appearance-none"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{getMonthName(m)}</option>
                ))}
              </select>
              <Calendar className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              id="reanalyze_gemini_btn"
              disabled={loading}
              onClick={() => runAnalysis(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-60 text-white font-bold rounded-2xl text-sm shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.analyzing}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>{t.reAnalyze}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── LOADING SKELETON STATE ──────────────────────────────── */}
      {loading && !insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          <div className="md:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 space-y-4">
            <div className="h-6 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
            <div className="h-4 w-2/3 bg-zinc-100 dark:bg-zinc-850 rounded-lg" />
            <div className="h-20 bg-zinc-50 dark:bg-zinc-850 rounded-2xl" />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 h-64" />
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 h-64" />
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 h-64" />
        </div>
      )}

      {/* ── MAIN INSIGHTS CONTENT ───────────────────────────────── */}
      {insights && (
        <div className="space-y-6">

          {/* 1. FINANCIAL HEALTH SCORE & EXECUTIVE SUMMARY CARD */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
              
              {/* Score Gauge */}
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 text-center">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-28 h-28 transform -rotate-90">
                    <circle cx="56" cy="56" r="46" stroke="currentColor" fill="none" strokeWidth="10" className="text-zinc-200 dark:text-zinc-800" />
                    <circle 
                      cx="56" 
                      cy="56" 
                      r="46" 
                      stroke="currentColor" 
                      fill="none" 
                      strokeWidth="10" 
                      strokeDasharray={289}
                      strokeDashoffset={289 - (289 * Math.min(100, Math.max(0, insights.healthScore))) / 100}
                      className={`${scoreTheme.bg} transition-all duration-1000 stroke-linecap-round`} 
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-zinc-900 dark:text-white">
                      {formatNumber(insights.healthScore, lang)}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">/ 100</span>
                  </div>
                </div>
                
                <span className={`mt-3 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${scoreTheme.badge}`}>
                  {insights.healthStatus}
                </span>
                <span className="text-2xs text-zinc-400 font-bold mt-1.5 uppercase tracking-wider">
                  {t.financialHealth}
                </span>
              </div>

              {/* Summary Description */}
              <div className="lg:col-span-3 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                    {lang === 'bn' ? `${getMonthName(selectedMonth)} এর আর্থিক মূল্যায়ন` : `Executive Assessment for ${getMonthName(selectedMonth)}`}
                  </h3>
                </div>
                <p className="text-sm sm:text-base text-zinc-650 dark:text-zinc-300 leading-relaxed font-medium">
                  {insights.summary}
                </p>

                {/* Quick snapshot chips */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-extrabold flex items-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'মোট বাকি' : 'Dues'}: ৳{formatNumber(monthData.dues, lang)}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold flex items-center gap-1.5">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'মোট আদায়' : 'Collected'}: ৳{formatNumber(monthData.payments, lang)}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-extrabold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{t.efficiency}: {formatNumber(monthData.efficiency, lang)}%</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 2. SPENDING PATTERNS & SAVINGS SUGGESTIONS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ── SPENDING PATTERNS ────────────────────────────── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-md space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white">
                    {t.spendingPatternsTitle}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    {lang === 'bn' ? 'গ্রাহকদের কেনাকাটা ও বাকি গ্রহণের প্রবণতা' : 'Observed customer purchasing and credit trends'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-3">
                {insights.spendingPatterns?.map((pattern, idx) => {
                  const isWarning = pattern.patternType === 'warning';
                  const isPositive = pattern.patternType === 'positive';

                  return (
                    <div 
                      key={idx}
                      className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 space-y-2 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                          {pattern.title}
                        </h4>
                        {pattern.impactMetric && (
                          <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg shrink-0 ${
                            isPositive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                            isWarning ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                            'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}>
                            {pattern.impactMetric}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                        {pattern.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── SAVINGS SUGGESTIONS ──────────────────────────── */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-md space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white">
                    {t.savingsSuggestionsTitle}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    {lang === 'bn' ? 'অতিরিক্ত লোকসান কমানো ও নগদ প্রবাহ বৃদ্ধির উপায়' : 'Actionable savings and bad-debt prevention methods'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-3">
                {insights.savingsSuggestions?.map((suggestion, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
                        {suggestion.category}
                      </span>
                      <div className="text-right">
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 block font-bold">
                          {t.estimatedSavings}
                        </span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {suggestion.potentialSavings}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                      {suggestion.title}
                    </h4>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 font-medium flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-zinc-900 dark:text-white mr-1">{t.actionPlan}:</strong>
                        {suggestion.actionPlan}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 3. UNUSUAL TRANSACTION SPIKES & OUTLIERS */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-md space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                    {t.unusualSpikesTitle}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    {lang === 'bn' ? 'স্বাভাবিক গড়ের চেয়ে অনেক বড় বা অস্বাভাবিক বাকি/পেমেন্ট এন্ট্রি' : 'Transactions significantly deviating from normal customer averages'}
                  </p>
                </div>
              </div>

              <span className="text-xs font-black px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {insights.unusualSpikes?.length || 0} {lang === 'bn' ? 'টি ঘটনা' : 'Events'}
              </span>
            </div>

            {(!insights.unusualSpikes || insights.unusualSpikes.length === 0) ? (
              <div className="p-8 text-center text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">{t.noSpikesDetected}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {insights.unusualSpikes.map((spike, idx) => {
                  const isHigh = spike.severity === 'high';
                  const isDueSpike = spike.spikeType === 'due_spike';

                  return (
                    <div 
                      key={idx}
                      className={`p-5 rounded-2xl border space-y-3 ${
                        isHigh 
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' 
                          : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isHigh ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                          }`}>
                            {spike.severity.toUpperCase()} {t.severity}
                          </span>
                          <h4 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white pt-1 truncate">
                            {spike.title}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-base sm:text-lg font-black ${
                            isDueSpike ? 'text-rose-600 dark:text-rose-450' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {spike.amount}
                          </span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold block truncate">
                            {spike.customerName}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                        {spike.explanation}
                      </p>

                      <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-zinc-900 dark:text-white block sm:inline mr-1">
                            {lang === 'bn' ? 'পরামর্শ:' : 'Recommendation:'}
                          </strong>
                          {spike.recommendation}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. ACTIONABLE TIPS CHECKLIST */}
          <div className="bg-emerald-600 dark:bg-emerald-700 text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden">
            <div className="space-y-3 relative z-10">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-emerald-200" />
                <h3 className="text-lg font-black tracking-tight">
                  {t.actionableTipsTitle}
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {insights.actionableTips?.map((tip, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 rounded-2xl bg-emerald-700/60 dark:bg-emerald-800/60 border border-white/15 text-xs sm:text-sm font-semibold leading-snug flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                      {formatNumber(idx + 1, lang)}
                    </span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
