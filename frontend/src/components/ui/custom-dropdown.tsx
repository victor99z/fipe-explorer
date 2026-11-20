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
  isActive,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const filteredOptions =
    searchable && searchTerm.trim()
      ? options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
      : options;

  const activeState =
    isActive !== undefined
      ? isActive
      : value !== undefined && value !== null && value !== '' && value !== '1990';

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      {renderTrigger ? (
        renderTrigger({ isOpen, setIsOpen, selectedOption, displayLabel, activeState })
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={cn(
            "h-8 w-full inline-flex items-center justify-between gap-2 px-3 rounded-xl text-xs font-medium transition-all duration-200 border cursor-pointer focus:outline-none",
            isOpen
              ? "border-[#2D2D2D] bg-[#CBE4F0]/55 text-[#2D2D2D] dark:border-[#CBE4F0] dark:bg-[#3B3948] dark:text-[#F5F2F3] shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
              : activeState
              ? "border-[#2D2D2D]/30 bg-[#CBE4F0] text-[#2D2D2D] font-semibold dark:border-[#CBE4F0]/70 dark:bg-[#CBE4F0] dark:text-[#2D2D2D]"
              : "border-[#2D2D2D]/20 bg-[#FFFDFB] text-[#2D2D2D]/80 hover:bg-[#FAF6F7] hover:text-[#2D2D2D] dark:border-[#F5F2F3]/20 dark:bg-[#242226] dark:text-[#F5F2F3]/80 dark:hover:bg-[#3B3948]"
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200",
              isOpen ? "rotate-180 text-[#2D2D2D] dark:text-[#CBE4F0]" : "text-[#2D2D2D]/55 dark:text-[#F5F2F3]/60"
            )}
            aria-hidden="true"
          />
        </button>
      )}

      {isOpen && (
        <div
          style={dropdownPositionStyle}
          className={cn(
            "absolute top-full mt-1.5 bg-[#FFFDFB] dark:bg-[#2D2D2D] border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 rounded-xl shadow-[0_8px_24px_rgba(45,45,45,0.12)] z-[200] p-1.5 flex flex-col",
            menuClassName
          )}
        >
          {searchable && (
            <div className="relative mb-1.5 px-0.5">
              <Search className="w-3.5 h-3.5 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-full rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FAF6F7] dark:bg-[#242226] pl-8 pr-6 text-xs text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 dark:placeholder:text-[#F5F2F3]/45 focus:border-[#2D2D2D] focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-1 focus:outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 hover:text-[#2D2D2D] dark:hover:text-[#F5F2F3] p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-3 px-2 text-center text-xs text-[#2D2D2D]/65 dark:text-[#F5F2F3]/65">
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
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-[8px] text-xs text-left cursor-pointer transition-colors duration-150",
                      isSelected
                        ? "bg-[#CBE4F0] text-[#2D2D2D] font-semibold"
                        : "text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 hover:bg-[#E6E6FA]/60 dark:hover:bg-[#3B3948] hover:text-[#2D2D2D] dark:hover:text-[#F5F2F3]"
                    )}
                  >
                    <span className="truncate mr-2">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#2D2D2D] flex-shrink-0" aria-hidden="true" />}
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
