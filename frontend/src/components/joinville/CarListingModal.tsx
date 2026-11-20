import React, { useEffect, useId, useState } from 'react';
import {
  Calendar,
  Car,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  EyeOff,
  Fuel,
  Gauge,
  Heart,
  MapPin,
  Save,
  Settings2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import { applyCarImageFallback, type CarListingItem } from '../../services/pocketbase';

interface CarListingModalProps {
  car: CarListingItem | null;
  onClose: () => void;
  onToggleFavorite: (car: CarListingItem) => Promise<void>;
  onToggleHidden: (car: CarListingItem) => Promise<void>;
  onSaveNotes: (car: CarListingItem, notes: string) => Promise<void>;
}

function formatBRL(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'Sob consulta';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function CarListingModal({
  car,
  onClose,
  onToggleFavorite,
  onToggleHidden,
  onSaveNotes,
}: CarListingModalProps) {
  const titleId = useId();
  const notesId = useId();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setPhotoIdx(0);
    setNotesDraft(car?.notes ?? '');
  }, [car]);

  useEffect(() => {
    if (!car) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [car, onClose]);

  if (!car) return null;

  const images = car.images;
  const activeEntry = images[photoIdx];
  const activeImage = activeEntry?.fullUrl;
  const fipeVal = car.fipeReferenceValue;
  const diffPct = car.fipeDiffPct;
  const isBelowFipe = diffPct !== null && diffPct <= 0;

  async function handleSaveNotes() {
    if (!car) return;
    setSavingNotes(true);
    try {
      await onSaveNotes(car, notesDraft);
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-4 sm:px-6 py-4 border-b border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717]">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border border-[#3ecf8e]/40">
                {car.portalName}
              </span>
              {car.sellerType && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border border-[#dfdfdf] dark:border-[#27272a]">
                  {car.sellerType}
                </span>
              )}
              {diffPct !== null && (
                <span
                  className={`inline-flex items-center gap-1 h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium tabular-nums border ${
                    isBelowFipe
                      ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isBelowFipe ? (
                    <TrendingDown className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <TrendingUp className="w-3 h-3" aria-hidden="true" />
                  )}
                  {formatPct(diffPct)} vs FIPE
                </span>
              )}
            </div>
            <h2
              id={titleId}
              className="text-base sm:text-lg font-semibold text-[#171717] dark:text-[#ededed] truncate"
            >
              {car.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do anúncio"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Gallery */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="relative aspect-[16/10] w-full rounded-lg overflow-hidden border border-[#ededed] dark:border-[#27272a] bg-[#f5f5f5] dark:bg-[#121212] flex items-center justify-center">
                {activeImage ? (
                  <img
                    key={activeImage}
                    src={activeImage}
                    alt={car.title}
                    onError={(e) => applyCarImageFallback(e.currentTarget, activeEntry?.fallbackUrl)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#9a9a9a] dark:text-[#71717a]">
                    <Car className="w-10 h-10 opacity-40" aria-hidden="true" />
                    <span className="text-xs">Sem fotos disponíveis</span>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPhotoIdx((i) => (i - 1 + images.length) % images.length)}
                      aria-label="Foto anterior"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoIdx((i) => (i + 1) % images.length)}
                      aria-label="Próxima foto"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={`${img.thumbUrl}-${idx}`}
                      type="button"
                      onClick={() => setPhotoIdx(idx)}
                      className={`h-14 w-20 shrink-0 rounded-md overflow-hidden border-2 transition-colors cursor-pointer ${
                        idx === photoIdx
                          ? 'border-[#3ecf8e]'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img.thumbUrl}
                        alt=""
                        onError={(e) => applyCarImageFallback(e.currentTarget, img.fallbackUrl)}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing + FIPE + Specs */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] p-4 space-y-3">
                <div>
                  <span className="text-xs text-[#707070] dark:text-[#a1a1aa]">Preço pedido</span>
                  <p className="text-2xl font-bold text-[#171717] dark:text-[#ededed] tabular-nums">
                    {formatBRL(car.price)}
                  </p>
                </div>

                {fipeVal ? (
                  <div className="pt-3 border-t border-[#ededed] dark:border-[#27272a] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#707070] dark:text-[#a1a1aa]">Tabela FIPE</span>
                      <span className="font-semibold text-[#171717] dark:text-[#ededed] tabular-nums">
                        {formatBRL(fipeVal)}
                      </span>
                    </div>
                    {car.fipeMatch && (
                      <div className="text-[11px] text-[#707070] dark:text-[#a1a1aa] space-y-0.5">
                        <p className="truncate">
                          {car.fipeMatch.nome_marca} {car.fipeMatch.nome_modelo} ({car.fipeMatch.ano_modelo})
                        </p>
                        <p>
                          Código FIPE:{' '}
                          <span className="font-mono text-[#171717] dark:text-[#ededed]">
                            {car.fipeMatch.codigo_fipe}
                          </span>{' '}
                          • Ref. <span className="tabular-nums">{car.fipeMatch.periodo_referencia}</span>
                        </p>
                      </div>
                    )}
                    {car.fipeDiffValue !== null && (
                      <p
                        className={`text-xs font-medium tabular-nums ${
                          car.fipeDiffValue <= 0
                            ? 'text-[#15803d] dark:text-[#3ecf8e]'
                            : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {car.fipeDiffValue <= 0
                          ? `${formatBRL(Math.abs(car.fipeDiffValue))} abaixo da FIPE`
                          : `${formatBRL(car.fipeDiffValue)} acima da FIPE`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#9a9a9a] dark:text-[#71717a] pt-2 border-t border-[#ededed] dark:border-[#27272a]">
                    Referência FIPE não pareada automaticamente para este modelo.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] p-2.5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3ecf8e] shrink-0" aria-hidden="true" />
                  <div>
                    <span className="block text-[10px] text-[#707070] dark:text-[#a1a1aa]">Ano</span>
                    <span className="font-medium tabular-nums">
                      {car.manufactureYear && car.year && car.manufactureYear !== car.year
                        ? `${car.manufactureYear}/${car.year}`
                        : car.year ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] p-2.5 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-[#3ecf8e] shrink-0" aria-hidden="true" />
                  <div>
                    <span className="block text-[10px] text-[#707070] dark:text-[#a1a1aa]">Quilometragem</span>
                    <span className="font-medium tabular-nums">
                      {car.mileageKm !== null ? `${car.mileageKm.toLocaleString('pt-BR')} km` : '—'}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] p-2.5 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[#3ecf8e] shrink-0" aria-hidden="true" />
                  <div>
                    <span className="block text-[10px] text-[#707070] dark:text-[#a1a1aa]">Câmbio</span>
                    <span className="font-medium">{car.transmission || '—'}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] p-2.5 flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-[#3ecf8e] shrink-0" aria-hidden="true" />
                  <div>
                    <span className="block text-[10px] text-[#707070] dark:text-[#a1a1aa]">Combustível</span>
                    <span className="font-medium">{car.fuel || '—'}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] p-2.5 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#3ecf8e] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <span className="block text-[10px] text-[#707070] dark:text-[#a1a1aa]">Localização</span>
                    <span className="font-medium truncate block">
                      {[car.neighborhood, car.city, car.state].filter(Boolean).join(', ') || 'Joinville, SC'}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] p-2.5 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#3ecf8e] shrink-0" aria-hidden="true" />
                  <div>
                    <span className="block text-[10px] text-[#707070] dark:text-[#a1a1aa]">Anunciante</span>
                    <span className="font-medium">{car.sellerType || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label htmlFor={notesId} className="block text-xs font-medium text-[#171717] dark:text-[#ededed]">
                  Observações pessoais
                </label>
                <textarea
                  id={notesId}
                  rows={2}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Ex.: único dono, agendar test drive, revisar histórico..."
                  className="w-full px-3 py-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed]"
                />
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                  className="h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] hover:border-[#3ecf8e]/50 text-xs font-medium cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5 text-[#3ecf8e]" aria-hidden="true" />
                  <span>{savingNotes ? 'Salvando...' : 'Salvar observação'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={car.favorite}
              onClick={() => void onToggleFavorite(car)}
              className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] border text-xs font-medium transition-colors cursor-pointer ${
                car.favorite
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40'
                  : 'bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${car.favorite ? 'fill-current' : ''}`} aria-hidden="true" />
              <span>{car.favorite ? 'Favorito' : 'Favoritar'}</span>
            </button>

            <button
              type="button"
              aria-pressed={car.hidden}
              onClick={() => void onToggleHidden(car)}
              className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] border text-xs font-medium transition-colors cursor-pointer ${
                car.hidden
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                  : 'bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{car.hidden ? 'Oculto' : 'Ocultar'}</span>
            </button>
          </div>

          <a
            href={car.ref}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold transition-colors"
          >
            <span>Abrir anúncio original</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
