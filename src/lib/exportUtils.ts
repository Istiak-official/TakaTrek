import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Customer, Transaction } from '../types';
import { formatNumber, Language } from './translations';

export interface CustomerExportData {
  customer: Customer;
  transactions: Transaction[];
  lang: Language;
}

export interface AllExportData {
  customers: Customer[];
  transactions: Transaction[];
  lang: Language;
}

export interface DailyExportData {
  date: Date;
  transactions: Transaction[];
  lang: Language;
}

export interface MonthlyExportData {
  monthName: string;
  year: number;
  month: number;
  transactions: Transaction[];
  lang: Language;
  totalDues: number;
  totalCollections: number;
  netBalance: number;
}

const formatDate = (dateVal: any, lang: Language): string => {
  if (!dateVal) return '';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatTime = (dateVal: any, lang: Language): string => {
  if (!dateVal) return '';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_').slice(0, 40) || 'Statement';
};

const badgeCache: Record<string, string> = {};

const getBadgeImage = (type: 'due' | 'payment', lang: Language): string => {
  const cacheKey = `${type}-${lang}`;
  if (badgeCache[cacheKey]) return badgeCache[cacheKey];

  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  const scale = 3; // 300+ DPI crisp vector-grade rendering
  const width = 48;
  const height = 19;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  const isDue = type === 'due';
  const isBn = lang === 'bn';
  const text = isDue ? (isBn ? 'বাকি' : 'DUE') : (isBn ? 'আদায়' : 'PAID');
  const bgColor = isDue ? '#ffe4e6' : '#dcfce7';
  const textColor = isDue ? '#e11d48' : '#15803d';
  const borderColor = isDue ? '#fecdd3' : '#86efac';

  // Draw rounded rectangle
  const r = 4;
  const x = 0.5;
  const y = 0.5;
  const w = width - 1;
  const h = height - 1;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Text rendering with strict centering
  ctx.fillStyle = textColor;
  ctx.font = isBn 
    ? "bold 10px 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif" 
    : "800 9.5px 'Outfit', 'Plus Jakarta Sans', Arial, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Optical vertical centering adjustment
  ctx.fillText(text, width / 2, height / 2 + 0.5);

  const dataUrl = canvas.toDataURL('image/png');
  badgeCache[cacheKey] = dataUrl;
  return dataUrl;
};

const renderTypeBadge = (type: 'due' | 'payment', lang: Language): string => {
  const dataUrl = getBadgeImage(type, lang);
  return `<img src="${dataUrl}" width="48" height="19" style="display: block; margin: 0 auto; width: 48px; height: 19px; vertical-align: middle;" alt="${type}" />`;
};

const pillCache: Record<string, string> = {};

const getPillHeaderImage = (text: string, isBn: boolean): string => {
  const cacheKey = `${text}-${isBn}`;
  if (pillCache[cacheKey]) return pillCache[cacheKey];
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  const scale = 3;
  const width = isBn ? 96 : 124;
  const height = 24;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  const r = height / 2;
  const x = 0.5;
  const y = 0.5;
  const w = width - 1;
  const h = height - 1;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();

  ctx.fillStyle = '#ecfdf5';
  ctx.fill();

  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#047857';
  ctx.font = isBn 
    ? "bold 11px 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif" 
    : "800 10.5px 'Outfit', 'Plus Jakarta Sans', Arial, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 0.5);

  const dataUrl = canvas.toDataURL('image/png');
  pillCache[cacheKey] = dataUrl;
  return dataUrl;
};

const renderPillBadge = (text: string, isBn: boolean): string => {
  const dataUrl = getPillHeaderImage(text, isBn);
  const width = isBn ? 96 : 124;
  return `<img src="${dataUrl}" width="${width}" height="24" style="display: block; width: ${width}px; height: 24px; margin-left: auto; margin-bottom: 4px;" alt="${text}" />`;
};

const balanceCache: Record<string, string> = {};

const renderCurrentBalanceImage = (dueAmount: number, lang: Language): string => {
  const isBn = lang === 'bn';
  const label = isBn ? 'বর্তমান ব্যালেন্স (বকেয়া)' : 'CURRENT BALANCE';
  let amountStr = '';
  if (dueAmount === 0) {
    amountStr = isBn ? 'পরিশোধিত (৳ ০)' : 'Settled (৳ 0)';
  } else {
    amountStr = `৳ ${formatNumber(dueAmount, lang)}`;
  }

  const cacheKey = `bal-${dueAmount}-${lang}`;
  if (balanceCache[cacheKey]) {
    return `<img src="${balanceCache[cacheKey]}" style="width: 100%; height: 32px; display: block; border-radius: 8px;" alt="Current Balance" />`;
  }

  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  const scale = 3;
  const width = 345;
  const height = 32;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  const bgColor = dueAmount > 0 ? '#fef2f2' : dueAmount < 0 ? '#ecfeff' : '#f8fafc';
  const borderColor = dueAmount > 0 ? '#fca5a5' : dueAmount < 0 ? '#a5f3fc' : '#e2e8f0';
  const amountColor = dueAmount > 0 ? '#dc2626' : dueAmount < 0 ? '#0891b2' : '#1e293b';

  const r = 8;
  const x = 0.5;
  const y = 0.5;
  const w = width - 1;
  const h = height - 1;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left label (vertically centered)
  ctx.fillStyle = '#475569';
  ctx.font = isBn 
    ? "bold 10px 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif" 
    : "700 9.5px 'Outfit', 'Plus Jakarta Sans', Arial, sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 12, height / 2 + 0.5);

  // Right Amount (vertically centered)
  ctx.fillStyle = amountColor;
  ctx.font = isBn 
    ? "bold 14px 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif" 
    : "800 14px 'Outfit', 'Plus Jakarta Sans', Arial, sans-serif";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(amountStr, width - 12, height / 2 + 0.5);

  const dataUrl = canvas.toDataURL('image/png');
  balanceCache[cacheKey] = dataUrl;

  return `<img src="${dataUrl}" style="width: 100%; height: 32px; display: block; border-radius: 8px;" alt="Current Balance" />`;
};

const pageBadgeCache: Record<string, string> = {};

const renderPageBadge = (pageNum: number, totalPages: number, isBn: boolean): string => {
  const text = isBn ? `পৃষ্ঠা ${pageNum} / ${totalPages}` : `Page ${pageNum} of ${totalPages}`;
  const cacheKey = `page-${pageNum}-${totalPages}-${isBn ? 'bn' : 'en'}`;
  
  const width = isBn ? 84 : 88;
  const height = 22;

  if (pageBadgeCache[cacheKey]) {
    return `<img src="${pageBadgeCache[cacheKey]}" width="${width}" height="${height}" style="display: block; width: ${width}px; height: ${height}px; margin-left: auto;" alt="${text}" />`;
  }

  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  const r = 6;
  const x = 0.5;
  const y = 0.5;
  const w = width - 1;
  const h = height - 1;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  ctx.fillStyle = '#f1f5f9';
  ctx.fill();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = isBn 
    ? "bold 10px 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif" 
    : "800 10px 'Outfit', 'Plus Jakarta Sans', Arial, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Shift slightly above middle baseline (height / 2) for optical balance
  ctx.fillText(text, width / 2, height / 2);

  const dataUrl = canvas.toDataURL('image/png');
  pageBadgeCache[cacheKey] = dataUrl;

  return `<img src="${dataUrl}" width="${width}" height="${height}" style="display: block; width: ${width}px; height: ${height}px; margin-left: auto;" alt="${text}" />`;
};

const downloadBlob = (content: BlobPart, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

/**
 * Common robust multi-page PDF rendering helper using html2canvas and jsPDF.
 * Renders each page as a discrete high-resolution A4 page container (scale: 3, 300+ DPI),
 * completely preventing table rows from being sliced or cut in half across pages.
 * Ensures consistent margins, footers, headers, and crisp 'Hind Siliguri' Bengali typography.
 */
const generateMultiPagePdfFromPages = async (pages: HTMLElement[], fileName: string): Promise<void> => {
  // Inject global scoped font definitions
  const fontStyle = document.createElement('style');
  fontStyle.id = 'challan-pdf-font-styles';
  fontStyle.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap');
    
    .challan-pdf-page {
      font-family: 'Hind Siliguri', 'Outfit', 'Plus Jakarta Sans', 'Noto Sans Bengali', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .challan-pdf-page * {
      box-sizing: border-box;
    }
  `;
  document.head.appendChild(fontStyle);

  // Hidden wrapper to hold all pages in DOM during rendering
  const wrapper = document.createElement('div');
  wrapper.id = 'pdf-pages-wrapper';
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.zIndex = '-9999';

  pages.forEach(p => wrapper.appendChild(p));
  document.body.appendChild(wrapper);

  // Preload and verify that Hind Siliguri fonts are ready before triggering html2canvas
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('400 14px "Hind Siliguri"'),
        document.fonts.load('500 14px "Hind Siliguri"'),
        document.fonts.load('600 14px "Hind Siliguri"'),
        document.fonts.load('700 14px "Hind Siliguri"'),
        document.fonts.ready
      ]);
    } catch {
      // Continue if font loading promise fails or times out
    }
  }

  // Small delay for DOM layout settling
  await new Promise(r => setTimeout(r, 120));

  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      const canvas = await html2canvas(pageEl, {
        scale: 3, // 300+ DPI razor-sharp high-definition rendering
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Strip stylesheets with Tailwind v4 oklch rules that crash html2canvas
          const styleElements = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styleElements.forEach((el) => {
            if (el.id !== 'challan-pdf-font-styles') {
              if (el.tagName === 'LINK' || (el.textContent && el.textContent.includes('oklch'))) {
                el.remove();
              }
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      if (i > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    pdf.save(fileName);
  } finally {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
    if (fontStyle.parentNode) {
      fontStyle.parentNode.removeChild(fontStyle);
    }
  }
};

const escapeCsvCell = (val: any): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

/**
 * Export specific customer's transaction history to CSV
 */
export const exportCustomerTransactionsToCSV = ({ customer, transactions, lang }: CustomerExportData) => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isBn = lang === 'bn';

  const totalDues = sorted.filter(t => t.type === 'due').reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = sorted.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);

  const lines: string[] = [];
  
  // Header section
  lines.push(`${escapeCsvCell(isBn ? 'টাকা ট্রেক - খতিয়ান বিবরণী' : 'TakaTrek - Customer Transaction Statement')}`);
  lines.push(`${escapeCsvCell(isBn ? 'গ্রাহকের নাম' : 'Customer Name')},${escapeCsvCell(customer.name)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোবাইল নম্বর' : 'Phone')},${escapeCsvCell(customer.phone || (isBn ? 'নেই' : 'N/A'))}`);
  lines.push(`${escapeCsvCell(isBn ? 'বর্তমান বকেয়া' : 'Current Outstanding Balance')},${escapeCsvCell(`৳ ${customer.outstandingDue}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট বাকি (+) ' : 'Total Dues (+)')},${escapeCsvCell(`৳ ${totalDues}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট আদায় (-) ' : 'Total Received (-)')},${escapeCsvCell(`৳ ${totalPaid}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'রিপোর্ট তৈরির তারিখ' : 'Exported On')},${escapeCsvCell(new Date().toLocaleString(isBn ? 'bn-BD' : 'en-US'))}`);
  lines.push(''); // blank separator

  // Table Columns
  lines.push([
    escapeCsvCell(isBn ? 'ক্রমিক' : 'SL'),
    escapeCsvCell(isBn ? 'তারিখ' : 'Date'),
    escapeCsvCell(isBn ? 'সময়' : 'Time'),
    escapeCsvCell(isBn ? 'লেনদেনের ধরন' : 'Type'),
    escapeCsvCell(isBn ? 'টাকার পরিমাণ (৳)' : 'Amount (BDT)'),
    escapeCsvCell(isBn ? 'বিবরণ / নোট' : 'Description / Notes'),
    escapeCsvCell(isBn ? 'ট্যাগ' : 'Tag')
  ].join(','));

  sorted.forEach((tx, idx) => {
    const sl = idx + 1;
    const dateStr = formatDate(tx.date, lang);
    const timeStr = formatTime(tx.date, lang);
    const typeStr = tx.type === 'due' 
      ? (isBn ? 'বাকি (Due)' : 'Due (+)')
      : (isBn ? 'আদায় (Payment)' : 'Payment (-)');
    const amountVal = (tx.type === 'due' ? '+' : '-') + tx.amount;
    const desc = tx.description || (tx.type === 'due' ? (isBn ? 'বাকি যুক্ত' : 'Due added') : (isBn ? 'পেমেন্ট জমা' : 'Payment received'));

    lines.push([
      escapeCsvCell(sl),
      escapeCsvCell(dateStr),
      escapeCsvCell(timeStr),
      escapeCsvCell(typeStr),
      escapeCsvCell(amountVal),
      escapeCsvCell(desc),
      escapeCsvCell(tx.tag || '')
    ].join(','));
  });

  // UTF-8 BOM (\uFEFF) ensures Excel and spreadsheets correctly display Bangla characters
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileName(customer.name)}_transactions_${dateStamp}.csv`;
  downloadBlob(csvContent, fileName, 'text/csv;charset=utf-8;');
};

/**
 * Export all customers' transactions to CSV
 */
export const exportAllTransactionsToCSV = ({ customers, transactions, lang }: AllExportData) => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isBn = lang === 'bn';

  const customerMap = new Map<string, Customer>();
  customers.forEach(c => customerMap.set(c.id, c));

  const totalDues = sorted.filter(t => t.type === 'due').reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = sorted.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);

  const lines: string[] = [];
  
  // Header section
  lines.push(`${escapeCsvCell(isBn ? 'টাকা ট্রেক - সকল গ্রাহকের লেনদেন খতিয়ান' : 'TakaTrek - All Customer Transactions Ledger')}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট গ্রাহক' : 'Total Customers')},${escapeCsvCell(customers.length)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট লেনদেন' : 'Total Transactions')},${escapeCsvCell(sorted.length)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট বকেয়া (+) ' : 'Total Dues (+)')},${escapeCsvCell(`৳ ${totalDues}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট আদায় (-) ' : 'Total Received (-)')},${escapeCsvCell(`৳ ${totalPaid}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'রিপোর্ট তৈরির তারিখ' : 'Exported On')},${escapeCsvCell(new Date().toLocaleString(isBn ? 'bn-BD' : 'en-US'))}`);
  lines.push('');

  // Table Columns
  lines.push([
    escapeCsvCell(isBn ? 'ক্রমিক' : 'SL'),
    escapeCsvCell(isBn ? 'তারিখ' : 'Date'),
    escapeCsvCell(isBn ? 'সময়' : 'Time'),
    escapeCsvCell(isBn ? 'গ্রাহকের নাম' : 'Customer Name'),
    escapeCsvCell(isBn ? 'ফোন নম্বর' : 'Phone'),
    escapeCsvCell(isBn ? 'লেনদেনের ধরন' : 'Type'),
    escapeCsvCell(isBn ? 'টাকার পরিমাণ (৳)' : 'Amount (BDT)'),
    escapeCsvCell(isBn ? 'বিবরণ / নোট' : 'Description / Notes'),
    escapeCsvCell(isBn ? 'ট্যাগ' : 'Tag'),
    escapeCsvCell(isBn ? 'গ্রাহকের মোট বাকি' : 'Current Due')
  ].join(','));

  sorted.forEach((tx, idx) => {
    const sl = idx + 1;
    const c = customerMap.get(tx.customerId);
    const customerName = tx.customerName || c?.name || (isBn ? 'অজানা গ্রাহক' : 'Unknown');
    const customerPhone = c?.phone || '';
    const dateStr = formatDate(tx.date, lang);
    const timeStr = formatTime(tx.date, lang);
    const typeStr = tx.type === 'due' 
      ? (isBn ? 'বাকি' : 'Due')
      : (isBn ? 'আদায়' : 'Payment');
    const amountVal = (tx.type === 'due' ? '+' : '-') + tx.amount;
    const desc = tx.description || '';
    const currentDue = c !== undefined ? `৳ ${c.outstandingDue}` : '';

    lines.push([
      escapeCsvCell(sl),
      escapeCsvCell(dateStr),
      escapeCsvCell(timeStr),
      escapeCsvCell(customerName),
      escapeCsvCell(customerPhone),
      escapeCsvCell(typeStr),
      escapeCsvCell(amountVal),
      escapeCsvCell(desc),
      escapeCsvCell(tx.tag || ''),
      escapeCsvCell(currentDue)
    ].join(','));
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `TakaTrek_All_Transactions_${dateStamp}.csv`;
  downloadBlob(csvContent, fileName, 'text/csv;charset=utf-8;');
};

/**
 * Export specific customer's transaction history to PDF
 */
export const exportCustomerTransactionsToPDF = async ({ customer, transactions, lang }: CustomerExportData): Promise<void> => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isBn = lang === 'bn';

  const totalDues = sorted.filter(t => t.type === 'due').reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = sorted.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const dateFormatted = new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Pagination configuration - Optimized to fully utilize A4 page space without awkward gaps
  const PAGE_1_CAPACITY = 19;
  const SUBSEQUENT_PAGE_CAPACITY = 24;
  const totalRecords = sorted.length;
  const totalPages = totalRecords <= PAGE_1_CAPACITY ? 1 : 1 + Math.ceil((totalRecords - PAGE_1_CAPACITY) / SUBSEQUENT_PAGE_CAPACITY);

  const pages: HTMLElement[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const startIndex = isFirstPage ? 0 : PAGE_1_CAPACITY + (pageNum - 2) * SUBSEQUENT_PAGE_CAPACITY;
    const capacity = isFirstPage ? PAGE_1_CAPACITY : SUBSEQUENT_PAGE_CAPACITY;
    const pageRows = sorted.slice(startIndex, startIndex + capacity);

    const pageDiv = document.createElement('div');
    pageDiv.className = 'challan-pdf-page';
    pageDiv.style.width = '794px';
    pageDiv.style.height = '1123px';
    pageDiv.style.minHeight = '1123px';
    pageDiv.style.maxHeight = '1123px';
    pageDiv.style.backgroundColor = '#ffffff';
    pageDiv.style.color = '#18181b';
    pageDiv.style.padding = '30px 36px';
    pageDiv.style.boxSizing = 'border-box';
    pageDiv.style.display = 'flex';
    pageDiv.style.flexDirection = 'column';
    pageDiv.style.justifyContent = 'space-between';
    pageDiv.style.overflow = 'hidden';

    // Top Section
    let topSectionHTML = '';

    if (isFirstPage) {
      topSectionHTML = `
        <!-- Statement Header -->
        <div style="border-bottom: 2px solid #009966; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #009966; letter-spacing: -0.5px; line-height: 1.2;">
              ${isBn ? 'টাকা ট্রেক' : 'TAKATREK'}
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 12.5px; font-weight: 600; color: #52525b; line-height: 1.3;">
              ${isBn ? 'গ্রাহক খতিয়ান ও লেনদেন বিবরণী' : 'Customer Ledger & Transaction Statement'}
            </p>
          </div>
          <div style="text-align: right;">
            ${renderPillBadge(isBn ? 'হিসাব খাতা' : 'AUDITED LEDGER', isBn)}
            <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: 600; color: #71717a; line-height: 1.3;">
              ${isBn ? 'তারিখ:' : 'Date:'} ${dateFormatted}
            </p>
          </div>
        </div>

        <!-- Customer Card & Totals Banner -->
        <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 12px; margin-bottom: 14px; align-items: stretch;">
          <table style="width: 100%; height: 96px; border-collapse: separate; border-spacing: 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="vertical-align: middle; padding: 12px 14px; border: none; text-align: left;">
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.8px; margin-bottom: 3px; line-height: 1;">
                    ${isBn ? 'গ্রাহকের তথ্য' : 'CUSTOMER PROFILE'}
                  </div>
                  <div style="font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.25; margin-bottom: 3px; word-break: break-word;">
                    ${customer.name}
                  </div>
                  <div style="font-size: 11.5px; font-weight: 600; color: #475569; line-height: 1.2;">
                    <span>📞 ${customer.phone || (isBn ? 'ফোন নম্বর নেই' : 'No phone listed')}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div style="display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <!-- Red Box: Total Dues -->
              <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; margin: 0; padding: 0;">
                <tbody>
                  <tr>
                    <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                      <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #be123c; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                        ${isBn ? 'মোট বাকি (+)' : 'TOTAL DUES (+)'}
                      </div>
                      <div style="font-size: 15px; font-weight: 800; color: #e11d48; line-height: 1.15; text-align: center;">
                        <span style="font-size: 12px; font-weight: 800;">+</span>
                        <span style="font-size: 13px; font-weight: 700;">৳</span>
                        <span>${formatNumber(totalDues, lang)}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Green Box: Total Got -->
              <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; margin: 0; padding: 0;">
                <tbody>
                  <tr>
                    <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                      <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #15803d; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                        ${isBn ? 'মোট আদায় (-)' : 'TOTAL GOT (-)'}
                      </div>
                      <div style="font-size: 15px; font-weight: 800; color: #16a34a; line-height: 1.15; text-align: center;">
                        <span style="font-size: 12px; font-weight: 800;">-</span>
                        <span style="font-size: 13px; font-weight: 700;">৳</span>
                        <span>${formatNumber(totalPaid, lang)}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Outstanding Balance -->
            ${renderCurrentBalanceImage(customer.outstandingDue, lang)}
          </div>
        </div>
      `;
    } else {
      // Continuation Header for Subsequent Pages
      topSectionHTML = `
        <div style="border-bottom: 2px solid #009966; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 17px; font-weight: 900; color: #009966; line-height: 1.2;">
              ${isBn ? 'টাকা ট্রেক - খতিয়ান বিবরণী (চলমান)' : 'TAKATREK - Customer Ledger (Cont.)'}
            </div>
            <div style="font-size: 11.5px; font-weight: 700; color: #334155; margin-top: 2px; line-height: 1.2;">
              ${isBn ? 'গ্রাহক:' : 'Customer:'} ${customer.name} ${customer.phone ? `• 📞 ${customer.phone}` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            ${renderPageBadge(pageNum, totalPages, isBn)}
          </div>
        </div>
      `;
    }

    // Table HTML
    const tableHTML = `
      <div style="margin-bottom: 6px;">
        ${isFirstPage ? `
          <div style="margin-bottom: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">
            ${isBn ? 'লেনদেনের বিস্তারিত ইতিহাস' : 'Transaction History'} (${sorted.length})
          </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
          <thead>
            <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8;">
              <th style="padding: 7px 5px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 34px; text-align: center;">#</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 125px; text-align: left;">${isBn ? 'তারিখ ও সময়' : 'Date & Time'}</th>
              <th style="padding: 7px 5px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 70px; text-align: center;">${isBn ? 'ধরন' : 'Type'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; text-align: left;">${isBn ? 'বিবরণ / নোট' : 'Description / Notes'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 105px; text-align: right;">${isBn ? 'পরিমাণ (৳)' : 'Amount (৳)'}</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 30px; text-align: center; color: #94a3b8; font-weight: 600;">
                  ${isBn ? 'কোনো লেনদেনের রেকর্ড পাওয়া যায়নি।' : 'No transaction records found.'}
                </td>
              </tr>
            ` : pageRows.map((tx, idx) => {
              const globalIdx = startIndex + idx + 1;
              const isDue = tx.type === 'due';
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              return `
                <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0; height: 34px;">
                  <td style="padding: 6px 5px; text-align: center; font-weight: 700; color: #64748b; font-size: 10px; vertical-align: middle;">
                    ${globalIdx}
                  </td>
                  <td style="padding: 6px 6px; vertical-align: middle;">
                    <div style="font-weight: 700; color: #1e293b; font-size: 11px; line-height: 1.2;">${formatDate(tx.date, lang)}</div>
                    <div style="font-size: 9.5px; color: #64748b; font-weight: 600; line-height: 1.1; margin-top: 1px;">${formatTime(tx.date, lang)}</div>
                  </td>
                  <td style="padding: 6px 5px; text-align: center; vertical-align: middle;">
                    ${renderTypeBadge(tx.type, lang)}
                  </td>
                  <td style="padding: 6px 6px; color: #334155; font-weight: 600; font-size: 11px; vertical-align: middle; line-height: 1.25;">
                    ${tx.description || (isDue ? (isBn ? 'বাকি এন্ট্রি' : 'Due record') : (isBn ? 'পেমেন্ট জমা' : 'Payment received'))}
                  </td>
                  <td style="padding: 6px 6px; text-align: right; vertical-align: middle; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; font-weight: 900; font-size: 12px; line-height: 1.2; color: ${isDue ? '#e11d48' : '#16a34a'};">
                      <span style="font-size: 10.5px; font-weight: 800;">${isDue ? '+' : '-'}</span>
                      <span style="font-size: 11px; font-weight: 700;">৳</span>
                      <span>${formatNumber(tx.amount, lang)}</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Footer HTML
    const footerHTML = `
      <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-weight: 600;">
        <div>
          ${isBn ? 'টাকা ট্রেক ডিজিটাল খতিয়ান দ্বারা স্বয়ংক্রিয়ভাবে তৈরি।' : 'Generated by TakaTrek Digital Ledger.'}
        </div>
        <div>
          ${isBn ? `পৃষ্ঠা ${pageNum} / ${totalPages} • মোট রেকর্ড: ${totalRecords}` : `Page ${pageNum} of ${totalPages} • Total Records: ${totalRecords}`}
        </div>
      </div>
    `;

    pageDiv.innerHTML = `
      <div style="flex: 1 1 auto; display: flex; flex-direction: column;">
        ${topSectionHTML}
        ${tableHTML}
      </div>
      ${footerHTML}
    `;

    pages.push(pageDiv);
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileName(customer.name)}_statement_${dateStamp}.pdf`;
  await generateMultiPagePdfFromPages(pages, fileName);
};

/**
 * Export all customers' transactions to PDF
 */
export const exportAllTransactionsToPDF = async ({ customers, transactions, lang }: AllExportData): Promise<void> => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isBn = lang === 'bn';

  const customerMap = new Map<string, Customer>();
  customers.forEach(c => customerMap.set(c.id, c));

  const totalDues = sorted.filter(t => t.type === 'due').reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = sorted.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingDue || 0), 0);
  const dateFormatted = new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Pagination configuration - Optimized to fully utilize A4 page space without awkward gaps
  const PAGE_1_CAPACITY = 20;
  const SUBSEQUENT_PAGE_CAPACITY = 24;
  const totalRecords = sorted.length;
  const totalPages = totalRecords <= PAGE_1_CAPACITY ? 1 : 1 + Math.ceil((totalRecords - PAGE_1_CAPACITY) / SUBSEQUENT_PAGE_CAPACITY);

  const pages: HTMLElement[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const startIndex = isFirstPage ? 0 : PAGE_1_CAPACITY + (pageNum - 2) * SUBSEQUENT_PAGE_CAPACITY;
    const capacity = isFirstPage ? PAGE_1_CAPACITY : SUBSEQUENT_PAGE_CAPACITY;
    const pageRows = sorted.slice(startIndex, startIndex + capacity);

    const pageDiv = document.createElement('div');
    pageDiv.className = 'challan-pdf-page';
    pageDiv.style.width = '794px';
    pageDiv.style.height = '1123px';
    pageDiv.style.minHeight = '1123px';
    pageDiv.style.maxHeight = '1123px';
    pageDiv.style.backgroundColor = '#ffffff';
    pageDiv.style.color = '#18181b';
    pageDiv.style.padding = '30px 36px';
    pageDiv.style.boxSizing = 'border-box';
    pageDiv.style.display = 'flex';
    pageDiv.style.flexDirection = 'column';
    pageDiv.style.justifyContent = 'space-between';
    pageDiv.style.overflow = 'hidden';

    let topSectionHTML = '';

    if (isFirstPage) {
      topSectionHTML = `
        <!-- Header -->
        <div style="border-bottom: 2px solid #009966; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #009966; letter-spacing: -0.5px; line-height: 1.2;">
              ${isBn ? 'টাকা ট্রেক' : 'TAKATREK'}
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 12.5px; font-weight: 600; color: #52525b; line-height: 1.3;">
              ${isBn ? 'সকল গ্রাহকের সর্বমোট লেনদেন খতিয়ান' : 'Master Customers Transaction Ledger Report'}
            </p>
          </div>
          <div style="text-align: right;">
            ${renderPillBadge(isBn ? 'মাস্টার রিপোর্ট' : 'MASTER REPORT', isBn)}
            <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: 600; color: #71717a; line-height: 1.3;">
              ${isBn ? 'তারিখ:' : 'Date:'} ${dateFormatted}
            </p>
          </div>
        </div>

        <!-- Summary Statistics Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px;">
          <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                    ${isBn ? 'মোট গ্রাহক' : 'CUSTOMERS'}
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.15; text-align: center;">
                    ${formatNumber(customers.length, lang)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #be123c; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                    ${isBn ? 'মোট বাকি (+)' : 'TOTAL DUES (+)'}
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: #e11d48; line-height: 1.15; text-align: center;">
                    <span style="font-size: 12px; font-weight: 800;">+</span>
                    <span style="font-size: 13px; font-weight: 700;">৳</span>
                    <span>${formatNumber(totalDues, lang)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #15803d; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                    ${isBn ? 'মোট আদায় (-)' : 'TOTAL PAID (-)'}
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: #16a34a; line-height: 1.15; text-align: center;">
                    <span style="font-size: 12px; font-weight: 800;">-</span>
                    <span style="font-size: 13px; font-weight: 700;">৳</span>
                    <span>${formatNumber(totalPaid, lang)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 10px; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #a16207; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                    ${isBn ? 'সার্বিক বাকি' : 'NET OUTSTANDING'}
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: #ca8a04; line-height: 1.15; text-align: center;">
                    <span style="font-size: 13px; font-weight: 700;">৳</span>
                    <span>${formatNumber(totalOutstanding, lang)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else {
      topSectionHTML = `
        <div style="border-bottom: 2px solid #009966; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 17px; font-weight: 900; color: #009966; line-height: 1.2;">
              ${isBn ? 'টাকা ট্রেক - সর্বজনীন লেনদেন খতিয়ান (চলমান)' : 'TAKATREK - Master Ledger Report (Cont.)'}
            </div>
            <div style="font-size: 11.5px; font-weight: 600; color: #52525b; margin-top: 2px; line-height: 1.2;">
              ${isBn ? 'তারিখ:' : 'Date:'} ${dateFormatted}
            </div>
          </div>
          <div style="text-align: right;">
            ${renderPageBadge(pageNum, totalPages, isBn)}
          </div>
        </div>
      `;
    }

    const tableHTML = `
      <div style="margin-bottom: 6px;">
        ${isFirstPage ? `
          <div style="margin-bottom: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">
            ${isBn ? 'সকল লেনদেনের বিস্তারিত তালিকা' : 'Complete Transactions Record'} (${sorted.length})
          </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: left;">
          <thead>
            <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8;">
              <th style="padding: 7px 5px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 32px; text-align: center;">#</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 100px;">${isBn ? 'তারিখ ও সময়' : 'Date & Time'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 135px;">${isBn ? 'গ্রাহক' : 'Customer'}</th>
              <th style="padding: 7px 5px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 68px; text-align: center;">${isBn ? 'ধরন' : 'Type'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155;">${isBn ? 'বিবরণ / নোট' : 'Notes'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 100px; text-align: right;">${isBn ? 'পরিমাণ (৳)' : 'Amount (৳)'}</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.length === 0 ? `
              <tr>
                <td colspan="6" style="padding: 30px; text-align: center; color: #94a3b8; font-weight: 600;">
                  ${isBn ? 'কোনো লেনদেনের রেকর্ড নেই।' : 'No transaction records found.'}
                </td>
              </tr>
            ` : pageRows.map((tx, idx) => {
              const globalIdx = startIndex + idx + 1;
              const isDue = tx.type === 'due';
              const c = customerMap.get(tx.customerId);
              const customerName = tx.customerName || c?.name || (isBn ? 'অজানা' : 'Unknown');
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              return `
                <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0; height: 33px;">
                  <td style="padding: 5px 5px; text-align: center; font-weight: 700; color: #64748b; font-size: 10px; vertical-align: middle;">
                    ${globalIdx}
                  </td>
                  <td style="padding: 5px 6px; vertical-align: middle;">
                    <div style="font-weight: 700; color: #1e293b; font-size: 10.5px; line-height: 1.2;">${formatDate(tx.date, lang)}</div>
                    <div style="font-size: 9px; color: #64748b; font-weight: 600; line-height: 1.1; margin-top: 1px;">${formatTime(tx.date, lang)}</div>
                  </td>
                  <td style="padding: 5px 6px; vertical-align: middle;">
                    <div style="font-weight: 800; color: #0f172a; font-size: 11px; line-height: 1.2;">${customerName}</div>
                    ${c?.phone ? `<div style="font-size: 9px; color: #64748b; font-weight: 600; line-height: 1.1; margin-top: 1px;">${c.phone}</div>` : ''}
                  </td>
                  <td style="padding: 5px 5px; text-align: center; vertical-align: middle;">
                    ${renderTypeBadge(tx.type, lang)}
                  </td>
                  <td style="padding: 5px 6px; color: #334155; font-weight: 600; font-size: 10.5px; vertical-align: middle; line-height: 1.25;">
                    ${tx.description || '-'}
                  </td>
                  <td style="padding: 5px 6px; text-align: right; vertical-align: middle; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; font-weight: 900; font-size: 11.5px; line-height: 1.2; color: ${isDue ? '#e11d48' : '#16a34a'};">
                      <span style="font-size: 10px; font-weight: 800;">${isDue ? '+' : '-'}</span>
                      <span style="font-size: 11px; font-weight: 700;">৳</span>
                      <span>${formatNumber(tx.amount, lang)}</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const footerHTML = `
      <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-weight: 600;">
        <div>
          ${isBn ? 'টাকা ট্রেক মাস্টার খতিয়ান রিপোর্ট।' : 'TakaTrek Master Ledger Report.'}
        </div>
        <div>
          ${isBn ? `পৃষ্ঠা ${pageNum} / ${totalPages} • মোট রেকর্ড: ${totalRecords}` : `Page ${pageNum} of ${totalPages} • Total Records: ${totalRecords}`}
        </div>
      </div>
    `;

    pageDiv.innerHTML = `
      <div style="flex: 1 1 auto; display: flex; flex-direction: column;">
        ${topSectionHTML}
        ${tableHTML}
      </div>
      ${footerHTML}
    `;

    pages.push(pageDiv);
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `TakaTrek_All_Transactions_${dateStamp}.pdf`;
  await generateMultiPagePdfFromPages(pages, fileName);
};

/**
 * Export specific day's transactions to CSV
 */
export const exportDailyTransactionsToCSV = ({ date, transactions, lang }: DailyExportData) => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isBn = lang === 'bn';

  const totalDues = sorted.filter(t => t.type === 'due').reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = sorted.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const dateFormatted = formatDate(date, lang);

  const lines: string[] = [];
  lines.push(`${escapeCsvCell(isBn ? 'টাকা ট্রেক - দৈনিক লেনদেন বিবরণী' : 'TakaTrek - Daily Transaction Statement')}`);
  lines.push(`${escapeCsvCell(isBn ? 'তারিখ' : 'Date')},${escapeCsvCell(dateFormatted)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট বাকি (+) ' : 'Total Dues (+)')},${escapeCsvCell(`৳ ${totalDues}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট আদায় (-) ' : 'Total Received (-)')},${escapeCsvCell(`৳ ${totalPaid}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট লেনদেন সংখ্যা' : 'Total Transactions')},${escapeCsvCell(`${sorted.length}`)}`);
  lines.push('');

  lines.push([
    escapeCsvCell(isBn ? 'ক্রমিক' : 'SL'),
    escapeCsvCell(isBn ? 'সময়' : 'Time'),
    escapeCsvCell(isBn ? 'গ্রাহকের নাম' : 'Customer Name'),
    escapeCsvCell(isBn ? 'লেনদেনের ধরন' : 'Type'),
    escapeCsvCell(isBn ? 'টাকার পরিমাণ (৳)' : 'Amount (BDT)'),
    escapeCsvCell(isBn ? 'বিবরণ / নোট' : 'Description / Notes'),
    escapeCsvCell(isBn ? 'ট্যাগ' : 'Tag')
  ].join(','));

  sorted.forEach((tx, idx) => {
    const sl = idx + 1;
    const timeStr = formatTime(tx.date, lang);
    const typeStr = tx.type === 'due' 
      ? (isBn ? 'বাকি (+)' : 'Due (+)')
      : (isBn ? 'আদায় (-)' : 'Payment (-)');
    const desc = tx.description || '-';

    lines.push([
      escapeCsvCell(sl),
      escapeCsvCell(timeStr),
      escapeCsvCell(tx.customerName || (isBn ? 'গ্রাহক' : 'Customer')),
      escapeCsvCell(typeStr),
      escapeCsvCell(tx.amount),
      escapeCsvCell(desc),
      escapeCsvCell(tx.tag || '')
    ].join(','));
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const dateStamp = date.toISOString().slice(0, 10);
  const fileName = `Daily_Transactions_${dateStamp}.csv`;
  downloadBlob(csvContent, fileName, 'text/csv;charset=utf-8;');
};

/**
 * Export specific day's transactions to PDF
 */
export const exportDailyTransactionsToPDF = async ({ date, transactions, lang }: DailyExportData): Promise<void> => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isBn = lang === 'bn';

  const totalDues = sorted.filter(t => t.type === 'due').reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = sorted.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const dateFormatted = date.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Pagination configuration - Optimized to fully utilize A4 page space without awkward gaps
  const PAGE_1_CAPACITY = 20;
  const SUBSEQUENT_PAGE_CAPACITY = 24;
  const totalRecords = sorted.length;
  const totalPages = totalRecords <= PAGE_1_CAPACITY ? 1 : 1 + Math.ceil((totalRecords - PAGE_1_CAPACITY) / SUBSEQUENT_PAGE_CAPACITY);

  const pages: HTMLElement[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const startIndex = isFirstPage ? 0 : PAGE_1_CAPACITY + (pageNum - 2) * SUBSEQUENT_PAGE_CAPACITY;
    const capacity = isFirstPage ? PAGE_1_CAPACITY : SUBSEQUENT_PAGE_CAPACITY;
    const pageRows = sorted.slice(startIndex, startIndex + capacity);

    const pageDiv = document.createElement('div');
    pageDiv.className = 'challan-pdf-page';
    pageDiv.style.width = '794px';
    pageDiv.style.height = '1123px';
    pageDiv.style.minHeight = '1123px';
    pageDiv.style.maxHeight = '1123px';
    pageDiv.style.backgroundColor = '#ffffff';
    pageDiv.style.color = '#18181b';
    pageDiv.style.padding = '30px 36px';
    pageDiv.style.boxSizing = 'border-box';
    pageDiv.style.display = 'flex';
    pageDiv.style.flexDirection = 'column';
    pageDiv.style.justifyContent = 'space-between';
    pageDiv.style.overflow = 'hidden';

    let topSectionHTML = '';

    if (isFirstPage) {
      topSectionHTML = `
        <!-- Header -->
        <div style="border-bottom: 2px solid #009966; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #009966; letter-spacing: -0.5px; line-height: 1.2;">
              ${isBn ? 'টাকা ট্রেক' : 'TAKATREK'}
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 12.5px; font-weight: 600; color: #52525b; line-height: 1.3;">
              ${isBn ? 'দৈনিক লেনদেন খতিয়ান বিবরণী' : 'Daily Transactions Ledger Report'}
            </p>
          </div>
          <div style="text-align: right;">
            ${renderPillBadge(isBn ? 'দৈনিক রিপোর্ট' : 'DAILY REPORT', isBn)}
            <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: 600; color: #71717a; line-height: 1.3;">
              ${dateFormatted}
            </p>
          </div>
        </div>

        <!-- Summary Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;">
          <!-- Red Box: Today's Dues -->
          <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #be123c; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                    ${isBn ? 'আজকের বাকি (+)' : 'TOTAL DUES (+)'}
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: #e11d48; line-height: 1.15; text-align: center;">
                    <span style="font-size: 12px; font-weight: 800;">+</span>
                    <span style="font-size: 13px; font-weight: 700;">৳</span>
                    <span>${formatNumber(totalDues, lang)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Green Box: Today's Got -->
          <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #15803d; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                    ${isBn ? 'আজকের আদায় (-)' : 'TOTAL GOT (-)'}
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: #16a34a; line-height: 1.15; text-align: center;">
                    <span style="font-size: 12px; font-weight: 800;">-</span>
                    <span style="font-size: 13px; font-weight: 700;">৳</span>
                    <span>${formatNumber(totalPaid, lang)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Count Box -->
          <table style="width: 100%; height: 56px; border-collapse: separate; border-spacing: 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="vertical-align: middle; text-align: center; padding: 3px 4px 7px 4px; border: none;">
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 2px; line-height: 1;">
                    ${isBn ? 'মোট লেনদেন সংখ্যা' : 'TOTAL COUNT'}
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.15; text-align: center;">
                    ${formatNumber(sorted.length, lang)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else {
      topSectionHTML = `
        <div style="border-bottom: 2px solid #009966; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 17px; font-weight: 900; color: #009966; line-height: 1.2;">
              ${isBn ? 'টাকা ট্রেক - দৈনিক খতিয়ান রিপোর্ট (চলমান)' : 'TAKATREK - Daily Ledger Report (Cont.)'}
            </div>
            <div style="font-size: 11.5px; font-weight: 600; color: #52525b; margin-top: 2px; line-height: 1.2;">
              ${dateFormatted}
            </div>
          </div>
          <div style="text-align: right;">
            ${renderPageBadge(pageNum, totalPages, isBn)}
          </div>
        </div>
      `;
    }

    const tableHTML = `
      <div style="margin-bottom: 6px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: left;">
          <thead>
            <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8;">
              <th style="padding: 7px 5px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 32px; text-align: center;">#</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 95px;">${isBn ? 'সময়' : 'Time'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 155px;">${isBn ? 'গ্রাহকের নাম' : 'Customer'}</th>
              <th style="padding: 7px 5px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 68px; text-align: center;">${isBn ? 'ধরন' : 'Type'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155;">${isBn ? 'বিবরণ / নোট' : 'Notes'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 100px; text-align: right;">${isBn ? 'পরিমাণ (৳)' : 'Amount (৳)'}</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.length === 0 ? `
              <tr>
                <td colspan="6" style="padding: 30px; text-align: center; color: #94a3b8; font-weight: 600;">
                  ${isBn ? 'এই তারিখে কোনো লেনদেন হয়নি।' : 'No transactions on this date.'}
                </td>
              </tr>
            ` : pageRows.map((tx, idx) => {
              const globalIdx = startIndex + idx + 1;
              const isDue = tx.type === 'due';
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              return `
                <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0; height: 33px;">
                  <td style="padding: 5px 5px; text-align: center; font-weight: 700; color: #64748b; font-size: 10px; vertical-align: middle;">
                    ${globalIdx}
                  </td>
                  <td style="padding: 5px 6px; color: #1e293b; font-weight: 600; vertical-align: middle; font-size: 10.5px;">
                    ${formatTime(tx.date, lang)}
                  </td>
                  <td style="padding: 5px 6px; color: #0f172a; font-weight: 800; vertical-align: middle; font-size: 11px;">
                    ${tx.customerName || (isBn ? 'গ্রাহক' : 'Customer')}
                  </td>
                  <td style="padding: 5px 5px; text-align: center; vertical-align: middle;">
                    ${renderTypeBadge(tx.type, lang)}
                  </td>
                  <td style="padding: 5px 6px; color: #334155; font-weight: 600; font-size: 10.5px; vertical-align: middle; line-height: 1.25;">
                    ${tx.description || '-'}
                  </td>
                  <td style="padding: 5px 6px; text-align: right; vertical-align: middle; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; font-weight: 900; font-size: 11.5px; line-height: 1.2; color: ${isDue ? '#e11d48' : '#16a34a'};">
                      <span style="font-size: 10px; font-weight: 800;">${isDue ? '+' : '-'}</span>
                      <span style="font-size: 11px; font-weight: 700;">৳</span>
                      <span>${formatNumber(tx.amount, lang)}</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const footerHTML = `
      <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-weight: 600;">
        <div>
          ${isBn ? 'টাকা ট্রেক - দৈনিক হিসাব খতিয়ান রিপোর্ট।' : 'TakaTrek Daily Ledger Statement.'}
        </div>
        <div>
          ${isBn ? `পৃষ্ঠা ${pageNum} / ${totalPages} • মোট রেকর্ড: ${totalRecords}` : `Page ${pageNum} of ${totalPages} • Total Records: ${totalRecords}`}
        </div>
      </div>
    `;

    pageDiv.innerHTML = `
      <div style="flex: 1 1 auto; display: flex; flex-direction: column;">
        ${topSectionHTML}
        ${tableHTML}
      </div>
      ${footerHTML}
    `;

    pages.push(pageDiv);
  }

  const dateStamp = date.toISOString().slice(0, 10);
  const fileName = `Daily_Transactions_${dateStamp}.pdf`;
  await generateMultiPagePdfFromPages(pages, fileName);
};

/**
 * Export specific month's transactions to CSV
 */
export const exportMonthlyTransactionsToCSV = ({
  monthName,
  year,
  month,
  transactions,
  lang,
  totalDues,
  totalCollections,
  netBalance
}: MonthlyExportData) => {
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isBn = lang === 'bn';

  const lines: string[] = [];
  lines.push(`${escapeCsvCell(isBn ? 'টাকা ট্রেক - মাসিক লেনদেন খতিয়ান বিবরণী' : 'TakaTrek - Monthly Transaction Statement')}`);
  lines.push(`${escapeCsvCell(isBn ? 'মাস ও বছর' : 'Month & Year')},${escapeCsvCell(monthName)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট নতুন বাকি (+)' : 'Total Dues (+)')},${escapeCsvCell(`৳ ${totalDues}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট নগদ আদায় (-)' : 'Total Collections (-)')},${escapeCsvCell(`৳ ${totalCollections}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'নিট ক্যাশ ব্যালেন্স' : 'Net Cash Balance')},${escapeCsvCell(`৳ ${netBalance}`)}`);
  lines.push(`${escapeCsvCell(isBn ? 'মোট লেনদেন সংখ্যা' : 'Total Transactions')},${escapeCsvCell(`${sorted.length}`)}`);
  lines.push('');

  lines.push([
    escapeCsvCell(isBn ? 'ক্রমিক' : 'SL'),
    escapeCsvCell(isBn ? 'তারিখ' : 'Date'),
    escapeCsvCell(isBn ? 'সময়' : 'Time'),
    escapeCsvCell(isBn ? 'গ্রাহকের নাম' : 'Customer Name'),
    escapeCsvCell(isBn ? 'লেনদেনের ধরন' : 'Type'),
    escapeCsvCell(isBn ? 'টাকার পরিমাণ (৳)' : 'Amount (BDT)'),
    escapeCsvCell(isBn ? 'বিবরণ / নোট' : 'Description / Notes'),
    escapeCsvCell(isBn ? 'ট্যাগ' : 'Tag')
  ].join(','));

  sorted.forEach((tx, idx) => {
    const sl = idx + 1;
    const dateStr = formatDate(tx.date, lang);
    const timeStr = formatTime(tx.date, lang);
    const typeStr = tx.type === 'due' 
      ? (isBn ? 'বাকি (+)' : 'Due (+)')
      : (isBn ? 'আদায় (-)' : 'Payment (-)');
    const desc = tx.description || '-';

    lines.push([
      escapeCsvCell(sl),
      escapeCsvCell(dateStr),
      escapeCsvCell(timeStr),
      escapeCsvCell(tx.customerName || (isBn ? 'গ্রাহক' : 'Customer')),
      escapeCsvCell(typeStr),
      escapeCsvCell(tx.amount),
      escapeCsvCell(desc),
      escapeCsvCell(tx.tag || '')
    ].join(','));
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const safeMonth = monthName.replace(/\s+/g, '_');
  const fileName = `Monthly_Statement_${safeMonth}.csv`;
  downloadBlob(csvContent, fileName, 'text/csv;charset=utf-8;');
};

/**
 * Export specific month's transactions to PDF statement
 */
export const exportMonthlyTransactionsToPDF = async ({
  monthName,
  year,
  month,
  transactions,
  lang,
  totalDues,
  totalCollections,
  netBalance
}: MonthlyExportData): Promise<void> => {
  const isBn = lang === 'bn';
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Pagination configuration - Optimized to fully utilize A4 page space without awkward gaps
  const PAGE_1_CAPACITY = 18;
  const SUBSEQUENT_PAGE_CAPACITY = 24;
  const totalRecords = sorted.length;
  const totalPages = totalRecords <= PAGE_1_CAPACITY ? 1 : 1 + Math.ceil((totalRecords - PAGE_1_CAPACITY) / SUBSEQUENT_PAGE_CAPACITY);

  const pages: HTMLElement[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const startIndex = isFirstPage ? 0 : PAGE_1_CAPACITY + (pageNum - 2) * SUBSEQUENT_PAGE_CAPACITY;
    const capacity = isFirstPage ? PAGE_1_CAPACITY : SUBSEQUENT_PAGE_CAPACITY;
    const pageRows = sorted.slice(startIndex, startIndex + capacity);

    const pageDiv = document.createElement('div');
    pageDiv.className = 'challan-pdf-page';
    pageDiv.style.width = '794px';
    pageDiv.style.height = '1123px';
    pageDiv.style.minHeight = '1123px';
    pageDiv.style.maxHeight = '1123px';
    pageDiv.style.backgroundColor = '#ffffff';
    pageDiv.style.color = '#18181b';
    pageDiv.style.padding = '30px 36px';
    pageDiv.style.boxSizing = 'border-box';
    pageDiv.style.display = 'flex';
    pageDiv.style.flexDirection = 'column';
    pageDiv.style.justifyContent = 'space-between';
    pageDiv.style.overflow = 'hidden';

    let topSectionHTML = '';

    if (isFirstPage) {
      topSectionHTML = `
        <!-- Header -->
        <div style="border-bottom: 2px solid #009966; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #009966; letter-spacing: -0.5px; line-height: 1.2;">
              ${isBn ? 'টাকা ট্রেক' : 'TAKATREK'}
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 12.5px; font-weight: 600; color: #52525b; line-height: 1.3;">
              ${isBn ? 'মাসিক লেনদেন খতিয়ান বিবরণী' : 'Monthly Transactions Ledger Statement'}
            </p>
          </div>
          <div style="text-align: right;">
            ${renderPillBadge(isBn ? 'মাসিক হিসাব' : 'MONTHLY STATEMENT', isBn)}
            <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: 600; color: #71717a; line-height: 1.3;">
              ${monthName}
            </p>
          </div>
        </div>

        <!-- 3-box Summary Metrics (Solid flat colors, NO gradients) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px;">
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.3px;">
              ${isBn ? 'মোট নগদ আদায়' : 'Total Collected'}
            </div>
            <div style="font-size: 16px; font-weight: 900; color: #15803d; margin-top: 3px;">
              ৳ ${formatNumber(totalCollections, lang)}
            </div>
          </div>

          <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; color: #9f1239; text-transform: uppercase; letter-spacing: 0.3px;">
              ${isBn ? 'মোট নতুন বাকি' : 'Total Dues Extended'}
            </div>
            <div style="font-size: 16px; font-weight: 900; color: #e11d48; margin-top: 3px;">
              ৳ ${formatNumber(totalDues, lang)}
            </div>
          </div>

          <div style="background-color: ${netBalance >= 0 ? '#eff6ff' : '#fff7ed'}; border: 1px solid ${netBalance >= 0 ? '#bfdbfe' : '#fed7aa'}; border-radius: 8px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; color: ${netBalance >= 0 ? '#1e40af' : '#9a3412'}; text-transform: uppercase; letter-spacing: 0.3px;">
              ${isBn ? 'নিট ক্যাশ ব্যালেন্স' : 'Net Cash Balance'}
            </div>
            <div style="font-size: 16px; font-weight: 900; color: ${netBalance >= 0 ? '#2563eb' : '#ea580c'}; margin-top: 3px;">
              ${netBalance >= 0 ? '+' : ''}৳ ${formatNumber(netBalance, lang)}
            </div>
          </div>
        </div>
      `;
    } else {
      topSectionHTML = `
        <!-- Continuation Header -->
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; font-weight: 800; color: #009966;">
            ${isBn ? 'টাকা ট্রেক' : 'TAKATREK'} • ${isBn ? 'মাসিক বিবরণী (চলমান)' : 'Monthly Statement (Contd.)'}
          </div>
          <div style="font-size: 11px; font-weight: 600; color: #64748b;">
            ${monthName}
          </div>
        </div>
      `;
    }

    const tableHTML = `
      <div style="flex: 1 1 auto; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-family: inherit;">
          <thead>
            <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8;">
              <th style="padding: 7px 5px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 30px; text-align: center;">#</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 85px;">${isBn ? 'তারিখ' : 'Date'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 145px;">${isBn ? 'গ্রাহকের নাম' : 'Customer'}</th>
              <th style="padding: 7px 5px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 68px; text-align: center;">${isBn ? 'ধরন' : 'Type'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155;">${isBn ? 'বিবরণ / নোট' : 'Notes'}</th>
              <th style="padding: 7px 6px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; color: #334155; width: 100px; text-align: right;">${isBn ? 'পরিমাণ (৳)' : 'Amount (৳)'}</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.length === 0 ? `
              <tr>
                <td colspan="6" style="padding: 30px; text-align: center; color: #94a3b8; font-weight: 600;">
                  ${isBn ? 'এই মাসে কোনো লেনদেন নেই।' : 'No transactions in this month.'}
                </td>
              </tr>
            ` : pageRows.map((tx, idx) => {
              const globalIdx = startIndex + idx + 1;
              const isDue = tx.type === 'due';
              const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              return `
                <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0; height: 33px;">
                  <td style="padding: 5px 5px; text-align: center; font-weight: 700; color: #64748b; font-size: 10px; vertical-align: middle;">
                    ${globalIdx}
                  </td>
                  <td style="padding: 5px 6px; color: #1e293b; font-weight: 600; vertical-align: middle; font-size: 10px;">
                    ${formatDate(tx.date, lang)}
                  </td>
                  <td style="padding: 5px 6px; color: #0f172a; font-weight: 800; vertical-align: middle; font-size: 11px;">
                    ${tx.customerName || (isBn ? 'গ্রাহক' : 'Customer')}
                  </td>
                  <td style="padding: 5px 5px; text-align: center; vertical-align: middle;">
                    ${renderTypeBadge(tx.type, lang)}
                  </td>
                  <td style="padding: 5px 6px; color: #334155; font-weight: 600; font-size: 10.5px; vertical-align: middle; line-height: 1.25;">
                    ${tx.description || '-'}
                  </td>
                  <td style="padding: 5px 6px; text-align: right; vertical-align: middle; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; font-weight: 900; font-size: 11.5px; line-height: 1.2; color: ${isDue ? '#e11d48' : '#16a34a'};">
                      <span style="font-size: 10px; font-weight: 800;">${isDue ? '+' : '-'}</span>
                      <span style="font-size: 11px; font-weight: 700;">৳</span>
                      <span>${formatNumber(tx.amount, lang)}</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const footerHTML = `
      <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-weight: 600;">
        <div>
          ${isBn ? 'টাকা ট্রেক - ডিজিটাল খতিয়ান ও হিসাব ব্যবস্থাপনা।' : 'TakaTrek - Digital Ledger & Cash Management.'}
        </div>
        <div>
          ${isBn ? `পৃষ্ঠা ${pageNum} / ${totalPages} • মোট রেকর্ড: ${totalRecords}` : `Page ${pageNum} of ${totalPages} • Total Records: ${totalRecords}`}
        </div>
      </div>
    `;

    pageDiv.innerHTML = `
      <div style="flex: 1 1 auto; display: flex; flex-direction: column;">
        ${topSectionHTML}
        ${tableHTML}
      </div>
      ${footerHTML}
    `;

    pages.push(pageDiv);
  }

  const safeMonth = monthName.replace(/\s+/g, '_');
  const fileName = `Monthly_Statement_${safeMonth}.pdf`;
  await generateMultiPagePdfFromPages(pages, fileName);
};
