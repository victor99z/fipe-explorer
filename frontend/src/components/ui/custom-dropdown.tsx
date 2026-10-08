import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DropdownOption<T = string | number> {
  value: T;
  label: string;
}

export interface CustomDropdownProps<T = string | number> {
  value?: T | null;
  onChange: (value: T) => void;
  options?: DropdownOption<T>[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  renderTrigger?: (params: {
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    selectedOption?: DropdownOption<T>;
    displayLabel: string;
    activeState: boolean;
  }) => React.ReactNode;
  isActive?: boolean;
}

export default function CustomDropdown<T extends string | number = string>({
  value,
  onChange,
  options = [],
  placeholder = 'Selecionar...',
  searchable = false,
  searchPlaceholder = 'Buscar...',
  className = '',
  menuClassName = '',
  align = 'left',
  renderTrigger,
  isActive = false,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Dynamic safe viewport positioning so dropdown never overflows left or right
  const [dropdownPositionStyle, setDropdownPositionStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const updatePosition = () => {
        if (!dropdownRef.current) return;
        const rect = dropdownRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const menuWidth = Math.min(280, viewportWidth - 24);
        
        let targetLeft = rect.left;
        if (align === 'right' || rect.left + menuWidth > viewportWidth - 12) {
          targetLeft = rect.right - menuWidth;
        }
        
        const clampedLeft = Math.max(12, Math.min(targetLeft, viewportWidth - menuWidth - 12));
        const offsetLeft = clampedLeft - rect.left;
        
        setDropdownPositionStyle({
          left: `${offsetLeft}px`,
          minWidth: `${Math.max(rect.width, Math.min(220, menuWidth))}px`,
          maxWidth: `${viewportWidth - 24}px`,
        });
      };
      
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, align]);

  // Focus search input when open
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const filteredOptions = searchable && searchTerm.trim()
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const activeState = isActive || (value !== undefined && value !== null && value !== '' && value !== '1990');

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      {renderTrigger ? (
        renderTrigger({ isOpen, setIsOpen, selectedOption, displayLabel, activeState })
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-8 w-full inline-flex items-center justify-between gap-2 px-2.5 rounded-[6px] text-xs transition-colors border cursor-pointer focus:outline-none",
            isOpen
              ? "border-[#3ecf8e] text-[#171717] dark:text-[#ededed] bg-[#ffffff] dark:bg-[#18181b] shadow-xs"
              : activeState
              ? "border-[#171717] dark:border-[#3ecf8e] text-[#171717] dark:text-[#ededed] bg-[#ffffff] dark:bg-[#18181b]"
              : "border-[#dfdfdf] dark:border-[#27272a] text-[#707070] dark:text-[#a1a1aa] bg-[#ffffff] dark:bg-[#121212] hover:bg-[#fafafa] dark:hover:bg-[#27272a] hover:text-[#171717] dark:hover:text-[#ededed]"
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            className={cn(
              "w-3 h-3 flex-shrink-0 transition-transform duration-150",
              isOpen ? "rotate-180 text-[#3ecf8e]" : "text-[#9a9a9a] dark:text-[#71717a]"
            )}
          />
        </button>
      )}

      {isOpen && (
        <div
          style={dropdownPositionStyle}
          className={cn(
            "absolute top-full mt-1.5 bg-[#ffffff] dark:bg-[#18181b] border border-[#dfdfdf] dark:border-[#27272a] rounded-[8px] shadow-2xl z-50 p-1.5 flex flex-col animate-in fade-in duration-100",
            menuClassName
          )}
        >
          {searchable && (
            <div className="relative mb-1.5 px-0.5 pt-0.5">
              <Search className="w-3.5 h-3.5 text-[#9a9a9a] dark:text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-7 w-full rounded-[4px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] pl-7 pr-6 text-xs text-[#171717] dark:text-[#ededed] placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] focus:border-[#3ecf8e] dark:focus:border-[#3ecf8e] focus:outline-none focus:ring-1 focus:ring-[#3ecf8e] transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9a9a9a] dark:text-[#71717a] hover:text-[#171717] dark:hover:text-[#ededed] p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-3 px-2 text-center text-xs text-[#707070] dark:text-[#a1a1aa]">
                Nenhuma opção encontrada
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-[4px] text-xs text-left cursor-pointer transition-colors",
                      isSelected
                        ? "bg-[#fafafa] dark:bg-[#27272a] text-[#171717] dark:text-[#ededed] font-medium"
                        : "text-[#707070] dark:text-[#a1a1aa] hover:bg-[#fafafa] dark:hover:bg-[#27272a] hover:text-[#171717] dark:hover:text-[#ededed]"
                    )}
                  >
                    <span className="truncate mr-2">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
