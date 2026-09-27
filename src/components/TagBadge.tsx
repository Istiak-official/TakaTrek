import React from 'react';
import { Tag as TagIcon, X } from 'lucide-react';

export interface TagBadgeProps {
  tag: string;
  size?: 'sm' | 'md' | 'lg';
  onRemove?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
  clickable?: boolean;
  className?: string;
  count?: number;
}

export const PRESET_TAGS = [
  'Paid by UPI',
  'Pending',
  'bKash',
  'Nagad',
  'Cash',
  'Bank Transfer'
];

export function getTagStyle(tag: string, isSelected: boolean = false) {
  const normalized = tag.toLowerCase().trim();

  if (isSelected) {
    return 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-sm';
  }

  if (normalized.includes('upi') || normalized.includes('online')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60';
  }
  if (normalized.includes('pending') || normalized.includes('বাকি')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';
  }
  if (normalized.includes('bkash') || normalized.includes('বিকাশ')) {
    return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800/60';
  }
  if (normalized.includes('nagad') || normalized.includes('নগদ')) {
    return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60';
  }
  if (normalized.includes('cash')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
  }
  if (normalized.includes('bank')) {
    return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60';
  }

  // Default custom tag
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
}

export default function TagBadge({
  tag,
  size = 'sm',
  onRemove,
  onClick,
  isSelected = false,
  clickable = false,
  className = '',
  count
}: TagBadgeProps) {
  if (!tag) return null;

  const colorClasses = getTagStyle(tag, isSelected);

  const sizeClasses = {
    sm: 'text-2xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2'
  }[size];

  const Comp = (onClick || clickable) ? 'button' : 'span';

  return (
    <Comp
      type={Comp === 'button' ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center font-bold rounded-full border transition-all select-none ${sizeClasses} ${colorClasses} ${
        (onClick || clickable) ? 'cursor-pointer hover:opacity-85 active:scale-95' : ''
      } ${className}`}
    >
      <TagIcon className={size === 'sm' ? 'w-2.5 h-2.5 shrink-0 opacity-70' : 'w-3 h-3 shrink-0 opacity-70'} />
      <span className="truncate max-w-[140px]">{tag}</span>
      {typeof count === 'number' && (
        <span className={`text-2xs px-1 rounded-full ${isSelected ? 'bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'bg-black/10 dark:bg-white/10'}`}>
          {count}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full cursor-pointer ml-0.5"
          title="Remove tag"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </Comp>
  );
}
