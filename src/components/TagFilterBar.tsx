import React from 'react';
import { Tag as TagIcon, X } from 'lucide-react';
import { getTagStyle } from './TagBadge';
import { Language } from '../lib/translations';
import { triggerHaptic } from '../lib/haptics';

interface TagCount {
  tag: string;
  count: number;
}

interface TagFilterBarProps {
  tags: TagCount[];
  selectedTag: string | null; // null = all, or string tag name, or '__untagged__'
  onSelectTag: (tag: string | null) => void;
  lang: Language;
  totalCount: number;
  untaggedCount?: number;
}

export default function TagFilterBar({
  tags,
  selectedTag,
  onSelectTag,
  lang,
  totalCount,
  untaggedCount = 0
}: TagFilterBarProps) {
  // If there are no tags and no untagged separation needed, don't clutter the UI
  if (tags.length === 0) return null;

  return (
    <div className="w-full py-1">
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar no-select py-1">
        <span className="text-2xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
          <TagIcon className="w-3 h-3" />
          <span>{lang === 'bn' ? 'ফিল্টার:' : 'Filter:'}</span>
        </span>

        {/* 'All' button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('tick');
            onSelectTag(null);
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
            selectedTag === null
              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-sm'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
          }`}
        >
          <span>{lang === 'bn' ? 'সব' : 'All'}</span>
          <span className={`text-2xs px-1 rounded-full ${
            selectedTag === null
              ? 'bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900'
              : 'bg-black/10 dark:bg-white/10'
          }`}>
            {totalCount}
          </span>
        </button>

        {/* Individual tag chips */}
        {tags.map(({ tag, count }) => {
          const isSelected = selectedTag === tag;
          const style = getTagStyle(tag, isSelected);

          return (
            <button
              key={tag}
              type="button"
              onClick={() => {
                triggerHaptic('tick');
                onSelectTag(isSelected ? null : tag);
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${style}`}
            >
              <TagIcon className="w-2.5 h-2.5 opacity-70" />
              <span className="truncate max-w-[120px]">{tag}</span>
              <span className={`text-2xs px-1 rounded-full ${
                isSelected
                  ? 'bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900'
                  : 'bg-black/10 dark:bg-white/10'
              }`}>
                {count}
              </span>
              {isSelected && (
                <X className="w-3 h-3 ml-0.5 opacity-80" />
              )}
            </button>
          );
        })}

        {/* Untagged chip if there are both tagged and untagged items */}
        {untaggedCount > 0 && tags.length > 0 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('tick');
              onSelectTag(selectedTag === '__untagged__' ? null : '__untagged__');
            }}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
              selectedTag === '__untagged__'
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-sm'
                : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 border-zinc-200/80 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-800'
            }`}
          >
            <span>{lang === 'bn' ? 'ট্যাগহীন' : 'Untagged'}</span>
            <span className={`text-2xs px-1 rounded-full ${
              selectedTag === '__untagged__'
                ? 'bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900'
                : 'bg-black/10 dark:bg-white/10'
            }`}>
              {untaggedCount}
            </span>
            {selectedTag === '__untagged__' && (
              <X className="w-3 h-3 ml-0.5 opacity-80" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
