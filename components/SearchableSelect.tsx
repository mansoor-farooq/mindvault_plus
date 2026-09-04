'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  searchPlaceholder?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  icon,
  searchPlaceholder = 'Search...'
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    return options.filter(opt => opt.label.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={wrapperRef} className="relative w-full text-left">
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full bg-slate-50 border rounded-xl px-4 py-3 font-semibold text-slate-800 transition-colors ${
          disabled 
            ? 'opacity-50 cursor-not-allowed border-slate-200' 
            : 'cursor-pointer hover:border-rose-300 border-slate-200 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20'
        } ${isOpen ? 'border-rose-500 ring-2 ring-rose-500/20' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          <span className={`truncate text-sm ${!selectedOption ? 'text-slate-400 font-medium' : 'text-slate-800'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
            <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent p-2 text-sm outline-none text-slate-700 font-medium"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200">
            {filteredOptions.length === 0 ? (
              <li className="p-4 text-center text-sm text-slate-400">No results found</li>
            ) : (
              filteredOptions.map(opt => (
                <li
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`flex items-center justify-between px-3 py-3 mt-1 rounded-xl cursor-pointer text-sm font-semibold transition-colors ${
                    opt.value === value
                      ? 'bg-rose-50 text-rose-700'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {opt.label}
                  {opt.value === value && <Check className="w-4 h-4 text-rose-600" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
