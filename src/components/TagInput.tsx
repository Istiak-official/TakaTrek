import React, { useState } from 'react';
import { Tag as TagIcon, Plus } from 'lucide-react';
import TagBadge, { PRESET_TAGS } from './TagBadge';
import { Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';

interface TagInputProps {
  value: string;
  onChange: (val: string) => void;
  lang: Language;
  existingTags?: string[];
  label?: string;
  placeholder?: string;
}

export default function TagInput({
  value,
  onChange,
  lang,
  existingTags = [],
  label,
  placeholder
}: TagInputProps) {
  const [customInput, setCustomInput] = useState('');
  const [showCustomField, setShowCustomField] = useState(false);

  // Combine default presets with any tags already used in the app
  const allPresets = Array.from(new Set([...PRESET_TAGS, ...existingTags.filter(Boolean)]));

  const handleSelectTag = (tag: string) => {
    triggerHaptic('tick');
    if (value === tag) {
      onChange(''); // toggle off
    } else {
      onChange(tag);
      setShowCustomField(false);
      setCustomInput('');
    }
  };

  const handleAddCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customInput.trim();
    if (clean) {
      triggerHaptic('tick');
      onChange(clean);
      setCustomInput('');
      setShowCustomField(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5" />
          <span>{label || (lang === 'bn' ? 'ট্যাগ (ঐচ্ছিক)' : 'Tag (Optional)')}</span>
        </label>
        {value && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('tick');
              onChange('');
            }}
            className="text-2xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 cursor-pointer"
          >
            {lang === 'bn' ? 'ট্যাগ মুছুন' : 'Clear tag'}
          </button>
        )}
      </div>

      {/* Selected Tag Active Pill */}
      {value ? (
        <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-850 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 pl-1">
            {lang === 'bn' ? 'নির্বাচিত ট্যাগ:' : 'Selected:'}
          </span>
          <TagBadge
            tag={value}
            size="md"
            onRemove={() => onChange('')}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {allPresets.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => handleSelectTag(tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer select-none ${
                  value === tag
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900'
                    : 'bg-zinc-50 dark:bg-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                + {tag}
              </button>
            ))}

            {!showCustomField ? (
              <button
                type="button"
                onClick={() => setShowCustomField(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-dashed border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                {lang === 'bn' ? 'অন্যান্য' : 'Custom'}
              </button>
            ) : null}
          </div>

          {/* Custom Input Field */}
          {showCustomField && (
            <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
              <input
                type="text"
                placeholder={placeholder || (lang === 'bn' ? 'কাস্টম ট্যাগ লিখুন (যেমন: UPI, বাকি)...' : 'Type custom tag...')}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                autoFocus
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleAddCustom()}
                disabled={!customInput.trim()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {lang === 'bn' ? 'যোগ' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomField(false);
                  setCustomInput('');
                }}
                className="px-2.5 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
