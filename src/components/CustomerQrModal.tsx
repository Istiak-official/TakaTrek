import React, { useEffect, useState, useRef } from 'react';
import { Customer } from '../types';
import QRCode from 'qrcode';
import { X, Download, Printer, Check, Copy, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, formatNumber, Language } from '../lib/translations';
import { generateCustomerQrData } from '../lib/qrUtils';
import { triggerHaptic } from '../lib/haptics';
import { toast } from 'sonner';

interface CustomerQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  lang: Language;
}

export default function CustomerQrModal({
  isOpen,
  onClose,
  customer,
  lang
}: CustomerQrModalProps) {
  const t = translations[lang];
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !customer) {
      setQrDataUrl('');
      return;
    }

    const payload = generateCustomerQrData(customer);
    setIsGenerating(true);

    QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#18181b', // Zinc 900, clean high-contrast
        light: '#ffffff'
      }
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
        toast.error(lang === 'bn' ? 'কিউআর কোড তৈরিতে সমস্যা হয়েছে' : 'Failed to generate QR code');
      })
      .finally(() => {
        setIsGenerating(false);
      });
  }, [isOpen, customer, lang]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !customer) return null;

  const handleDownload = () => {
    if (!qrDataUrl) return;
    triggerHaptic('single');

    // Create a composite branded canvas for downloading
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 760;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Solid white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border around card
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    // Top Header bar - solid emerald
    ctx.fillStyle = '#059669';
    ctx.fillRect(16, 16, canvas.width - 32, 90);

    // App title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAKATREK', canvas.width / 2, 70);

    // Customer Name
    ctx.fillStyle = '#18181b';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(customer.name, canvas.width / 2, 170);

    // Customer Phone
    ctx.fillStyle = '#71717a';
    ctx.font = '20px sans-serif';
    ctx.fillText(customer.phone ? customer.phone : (lang === 'bn' ? 'মোবাইল নম্বর নেই' : 'No phone listed'), canvas.width / 2, 205);

    // QR Code Image
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, (canvas.width - 360) / 2, 240, 360, 360);

      // Footer divider
      ctx.strokeStyle = '#f4f4f5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 630);
      ctx.lineTo(canvas.width - 40, 630);
      ctx.stroke();

      // Scan instruction
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(
        lang === 'bn' ? 'কুইক এন্ট্রি স্ক্যানার দিয়ে স্ক্যান করুন' : 'Scan with Quick Entry to Record Transaction',
        canvas.width / 2,
        670
      );

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '14px sans-serif';
      ctx.fillText(
        lang === 'bn' ? 'ব্যক্তিগত গ্রাহক আইডি: ' + customer.id.slice(0, 10) : 'Customer ID: ' + customer.id.slice(0, 10),
        canvas.width / 2,
        705
      );

      // Trigger download
      const link = document.createElement('a');
      link.download = `QR-${customer.name.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success(lang === 'bn' ? 'কিউআর কোড ডাউনলোড সম্পন্ন হয়েছে' : 'QR code image downloaded');
    };
    qrImg.src = qrDataUrl;
  };

  const handleCopy = () => {
    if (!customer) return;
    const payload = generateCustomerQrData(customer);
    navigator.clipboard.writeText(payload).then(() => {
      setCopied(true);
      triggerHaptic('single');
      toast.success(lang === 'bn' ? 'কিউআর ডাটা কপি করা হয়েছে' : 'QR data copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    triggerHaptic('single');
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 text-white rounded-xl">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  {t.customerQrCode}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {lang === 'bn' ? 'দ্রুত লেনদেন লিপিবদ্ধ করার কোড' : 'Scan to auto-fill customer name'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex flex-col items-center text-center overflow-y-auto">
            <div ref={cardRef} className="w-full flex flex-col items-center">
              {/* Customer Title */}
              <h2 className="text-xl font-black text-zinc-900 dark:text-white truncate max-w-xs">
                {customer.name}
              </h2>
              {customer.phone && (
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {customer.phone}
                </p>
              )}

              {/* Outstanding balance badge */}
              <div className="mt-2 mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                <span>{t.currentBalance}:</span>
                <span
                  className={
                    customer.outstandingDue > 0
                      ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                      : customer.outstandingDue < 0
                      ? 'text-cyan-600 dark:text-cyan-400 font-extrabold'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }
                >
                  {customer.outstandingDue === 0
                    ? t.settled
                    : `৳ ${formatNumber(customer.outstandingDue, lang)}`}
                </span>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-white rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center justify-center">
                {isGenerating || !qrDataUrl ? (
                  <div className="w-56 h-56 flex flex-col items-center justify-center gap-2">
                    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-zinc-500">{t.scanningQr}</span>
                  </div>
                ) : (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code for ${customer.name}`}
                    className="w-56 h-56 object-contain block"
                  />
                )}
              </div>

              {/* Scan explanation */}
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-4 max-w-xs leading-relaxed">
                {t.scanQrInstruction}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 w-full mt-6">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!qrDataUrl}
                className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{t.downloadQr}</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="py-3 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'কোড কপি' : 'Copy Code')}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
