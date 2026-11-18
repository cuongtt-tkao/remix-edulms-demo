import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  group?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  leadingIcon?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  buttonClassName?: string;
  menuMinWidth?: number;
  align?: 'left' | 'right';
  ariaLabel?: string;
  title?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  disabled = false,
  searchable,
  searchPlaceholder = 'Tìm nhanh...',
  leadingIcon,
  size = 'md',
  className = '',
  buttonClassName = '',
  menuMinWidth = 220,
  align = 'left',
  ariaLabel,
  title,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showSearch = searchable ?? options.length >= 9;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)) ||
        (opt.group && opt.group.toLowerCase().includes(q))
    );
  }, [options, query]);

  const computePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(180, Math.min(320, openUp ? spaceAbove : spaceBelow));
    const width = Math.max(rect.width, menuMinWidth);
    let left = align === 'right' ? rect.right - width : rect.left;
    if (left + width > viewportW - 8) left = Math.max(8, viewportW - width - 8);
    if (left < 8) left = 8;

    setMenuPosition({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left,
      width: Math.min(width, viewportW - 16),
      maxHeight,
      openUp,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    computePosition();

    const handleReposition = () => computePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, align, menuMinWidth]);

  useEffect(() => {
    if (isOpen) {
      const selectedIdx = filteredOptions.findIndex((o) => o.value === value && !o.disabled);
      setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
      if (showSearch) {
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (opt: CustomSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(filteredOptions.length - 1, prev + 1));
      } else if (e.key === 'Enter' && activeIndex >= 0 && filteredOptions[activeIndex]) {
        e.preventDefault();
        handleSelect(filteredOptions[activeIndex]);
      }
    } else if (isOpen && e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const sizeClasses =
    size === 'sm'
      ? 'min-h-[38px] px-3 py-1.5 text-xs rounded-xl gap-1.5'
      : 'min-h-[42px] px-3.5 py-2 text-sm rounded-xl gap-2';

  const hasGroups = filteredOptions.some((o) => Boolean(o.group));

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={title}
        className={`w-full flex items-center justify-between text-left border transition-all duration-150 select-none ${sizeClasses} ${
          disabled
            ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-75'
            : isOpen
            ? 'bg-white dark:bg-slate-900 border-sky-500 ring-2 ring-sky-500/20 text-slate-900 dark:text-white shadow-sm'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-100 shadow-xs'
        } ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {leadingIcon && (
            <span className="shrink-0 text-slate-400 dark:text-slate-500 flex items-center">
              {leadingIcon}
            </span>
          )}
          <span
            className={`truncate font-semibold ${
              selectedOption ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 font-medium'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/70">
              {selectedOption.badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-sky-600 dark:text-sky-400' : ''
          }`}
        />
      </button>

      {isOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: menuPosition.openUp ? undefined : menuPosition.top,
              bottom: menuPosition.openUp ? window.innerHeight - menuPosition.top : undefined,
              left: menuPosition.left,
              width: menuPosition.width,
              zIndex: 9999,
            }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/95 dark:border-slate-700 shadow-2xl ring-1 ring-slate-950/5 dark:ring-white/10 overflow-hidden animate-in fade-in duration-100"
          >
            {showSearch && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setActiveIndex((prev) => Math.min(filteredOptions.length - 1, prev + 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActiveIndex((prev) => Math.max(0, prev - 1));
                      } else if (e.key === 'Enter' && filteredOptions[activeIndex]) {
                        e.preventDefault();
                        handleSelect(filteredOptions[activeIndex]);
                      }
                    }}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div
              style={{ maxHeight: menuPosition.maxHeight }}
              className="overflow-y-auto py-1.5 px-1.5 space-y-0.5"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-5 text-center text-xs text-slate-400 dark:text-slate-500">
                  Không tìm thấy mục phù hợp
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isActive = idx === activeIndex;
                  const prevGroup = idx > 0 ? filteredOptions[idx - 1].group : undefined;
                  const showGroupHeader = hasGroups && opt.group && opt.group !== prevGroup;

                  return (
                    <React.Fragment key={`${opt.value}-${idx}`}>
                      {showGroupHeader && (
                        <div className="px-2.5 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {opt.group}
                        </div>
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => handleSelect(opt)}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${
                          opt.disabled
                            ? 'opacity-45 cursor-not-allowed text-slate-400'
                            : isSelected
                            ? 'bg-sky-50 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200'
                            : isActive
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs sm:text-[13px] truncate ${
                                isSelected ? 'font-bold' : 'font-medium'
                              }`}
                            >
                              {opt.label}
                            </span>
                            {opt.badge && (
                              <span
                                className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                  isSelected
                                    ? 'bg-sky-100 dark:bg-sky-800/60 text-sky-700 dark:text-sky-200 border-sky-200 dark:border-sky-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          {opt.description && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              {opt.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
