import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { translations, Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';
import { toast } from 'sonner';

interface ExportMergedButtonProps {
  onExportPDF: () => Promise<void>;
  onExportCSV: () => void | Promise<void>;
  lang: Language;
  label?: string;
  disabled?: boolean;
  align?: 'left' | 'right' | 'auto';
  variant?: 'default' | 'compact' | 'primary' | 'outline' | 'pill';
  id?: string;
  className?: string;
}

export const ExportMergedButton: React.FC<ExportMergedButtonProps> = ({
  onExportPDF,
  onExportCSV,
  lang,
  label,
  disabled = false,
  align = 'right',
  variant = 'default',
  id = 'merged_export_btn',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  // Close on outside click or ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') {
        setIsOpen(false);
      } else if (e instanceof MouseEvent && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleDown);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled || isExportingPdf) return;
    triggerHaptic('single');
    setIsOpen(prev => !prev);
  };

  const handlePdfClick = async () => {
    setIsOpen(false);
    if (disabled || isExportingPdf) return;
    triggerHaptic('single');
    setIsExportingPdf(true);
    const toastId = toast.loading(t.generatingPdf || (lang === 'bn' ? 'পিডিএফ তৈরি হচ্ছে...' : 'Preparing PDF statement...'));
    try {
      await onExportPDF();
      toast.success(t.pdfSuccess || (lang === 'bn' ? 'পিডিএফ ডাউনলোড সম্পন্ন হয়েছে' : 'PDF downloaded successfully'), { id: toastId });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(lang === 'bn' ? 'পিডিএফ তৈরি করতে সমস্যা হয়েছে!' : 'Failed to generate PDF!', { id: toastId });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCsvClick = async () => {
    setIsOpen(false);
    if (disabled) return;
    triggerHaptic('single');
    try {
      await onExportCSV();
      toast.success(t.csvSuccess || (lang === 'bn' ? 'সিএসভি ফাইল ডাউনলোড হয়েছে' : 'CSV downloaded successfully'));
    } catch (err) {
      console.error('CSV export error:', err);
      toast.error(lang === 'bn' ? 'সিএসভি ডাউনলোড করতে সমস্যা হয়েছে!' : 'Failed to generate CSV!');
    }
  };

  // Base styling classes
  let buttonClasses = 'font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 select-none ';

  if (variant === 'compact') {
    buttonClasses += 'px-2.5 py-1 text-xs rounded-lg border ';
  } else if (variant === 'pill') {
    buttonClasses += 'px-3.5 py-1.5 text-xs rounded-full border ';
  } else if (variant === 'primary') {
    buttonClasses += 'px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border border-emerald-600 ';
  } else {
    buttonClasses += 'px-3.5 py-2 text-xs sm:text-sm rounded-xl border shadow-sm ';
  }

  if (disabled) {
    buttonClasses += 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-800';
  } else if (isOpen) {
    buttonClasses += 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-500/20';
  } else if (variant !== 'primary') {
    buttonClasses += 'bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600';
  }

  if (className) {
    buttonClasses += ` ${className}`;
  }

  const dropdownAlignClass = align === 'left' 
    ? 'left-0 origin-top-left' 
    : 'right-0 origin-top-right';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        id={id}
        onClick={handleToggle}
        disabled={disabled || isExportingPdf}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={buttonClasses}
        title={lang === 'bn' ? 'লেনদেন ইতিহাস এক্সপোর্ট করুন (PDF / CSV)' : 'Export transaction history (PDF / CSV)'}
      >
        {isExportingPdf ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        )}
        <span className="truncate">{label || t.exportBtn || (lang === 'bn' ? 'এক্সপোর্ট' : 'Export')}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute ${dropdownAlignClass} mt-1.5 w-64 sm:w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[100] p-1.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md`}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header Title */}
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/80 mb-1 flex items-center justify-between">
            <p className="text-2xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {lang === 'bn' ? 'এক্সপোর্ট ফরম্যাট নির্বাচন করুন' : 'Select Export Format'}
            </p>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
              PDF / CSV
            </span>
          </div>

          {/* PDF Option */}
          <button
            type="button"
            onClick={handlePdfClick}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50/80 dark:hover:bg-rose-950/30 text-left transition-colors cursor-pointer group focus:outline-none focus:bg-rose-50 dark:focus:bg-rose-950/30"
            role="menuitem"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span className="truncate">{t.exportAsPdf || (lang === 'bn' ? 'পিডিএফ (PDF) ডাউনলোড' : 'Export as PDF')}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 shrink-0">
                  PDF
                </span>
              </div>
              <div className="text-2xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                {t.pdfDesc || (lang === 'bn' ? 'প্রিন্ট ও শেয়ারের উপযুক্ত পূর্ণাঙ্গ খতিয়ান' : 'Printable statement in A4')}
              </div>
            </div>
          </button>

          {/* CSV Option */}
          <button
            type="button"
            onClick={handleCsvClick}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 text-left transition-colors cursor-pointer group focus:outline-none focus:bg-emerald-50 dark:focus:bg-emerald-950/30 mt-1"
            role="menuitem"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span className="truncate">{t.exportAsCsv || (lang === 'bn' ? 'সিএসভি / এক্সেল (CSV)' : 'Export as CSV')}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                  CSV
                </span>
              </div>
              <div className="text-2xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                {t.csvDesc || (lang === 'bn' ? 'এক্সেল বা গুগল শিটে খোলার উপযোগী স্প্রেডশিট' : 'Excel & spreadsheet compatible')}
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
