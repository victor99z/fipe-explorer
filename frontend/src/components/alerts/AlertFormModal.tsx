import React, { useEffect, useId, useState } from 'react';
import { BellPlus, Loader2, X } from 'lucide-react';
import type { CarAlertInput, CarAlertItem } from '../../services/alerts';
import { CAMBIO_FILTER_OPTIONS } from '../../services/pocketbase';
import { NativeDialog } from '../ui/NativeDialog';

export interface AlertFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CarAlertInput, editingId?: string) => Promise<void>;
  editingAlert?: CarAlertItem | null;
  prefill?: Partial<CarAlertInput> | null;
}

export function AlertFormModal({
  open,
  onClose,
  onSubmit,
  editingAlert,
  prefill,
}: AlertFormModalProps) {
  const titleId = useId();
  const nameId = useId();
  const queryId = useId();
  const brandId = useId();
  const cityId = useId();
  const portalId = useId();
  const minYearId = useId();
  const maxYearId = useId();
  const minPriceId = useId();
  const maxPriceId = useId();
  const maxKmId = useId();
  const motorId = useId();
  const cambioId = useId();
  const fuelId = useId();
  const minDiscountId = useId();

  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [city, setCity] = useState('');
  const [portal, setPortal] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [motorizacao, setMotorizacao] = useState('');
  const [transmission, setTransmission] = useState('');
  const [fuel, setFuel] = useState('');
  const [onlyBelowFipe, setOnlyBelowFipe] = useState(false);
  const [minFipeDiscountPct, setMinFipeDiscountPct] = useState('');
  const [notifyOnNew, setNotifyOnNew] = useState(true);
  const [notifyOnPriceDrop, setNotifyOnPriceDrop] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    const src = editingAlert ?? prefill ?? {};
    const defaultName =
      src.name ||
      [src.brand, src.searchQuery, src.minYear ? String(src.minYear) : '']
        .filter(Boolean)
        .join(' ')
        .trim() ||
      '';

    setName(defaultName);
    setSearchQuery(src.searchQuery ?? '');
    setBrand(src.brand ?? '');
    setCity(src.city ?? '');
    setPortal(src.portal ?? '');
    setMinYear(src.minYear && src.minYear > 0 ? String(src.minYear) : '');
    setMaxYear(src.maxYear && src.maxYear > 0 ? String(src.maxYear) : '');
    setMinPrice(src.minPrice && src.minPrice > 0 ? String(src.minPrice) : '');
    setMaxPrice(src.maxPrice && src.maxPrice > 0 ? String(src.maxPrice) : '');
    setMaxKm(src.maxKm && src.maxKm > 0 ? String(src.maxKm) : '');
    setMotorizacao(src.motorizacao ?? '');
    setTransmission(src.transmission ?? '');
    setFuel(src.fuel ?? '');
    setOnlyBelowFipe(Boolean(src.onlyBelowFipe));
    setMinFipeDiscountPct(
      src.minFipeDiscountPct && src.minFipeDiscountPct > 0
        ? String(src.minFipeDiscountPct)
        : '',
    );
    setNotifyOnNew(src.notifyOnNew ?? true);
    setNotifyOnPriceDrop(src.notifyOnPriceDrop ?? true);
  }, [open, editingAlert, prefill]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Dê um nome identificador ao alerta.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(
        {
          name: name.trim(),
          active: editingAlert ? editingAlert.active : true,
          searchQuery: searchQuery.trim(),
          brand: brand.trim(),
          fipeCode: editingAlert?.fipeCode ?? prefill?.fipeCode ?? '',
          city: city.trim(),
          portal: portal.trim(),
          minYear: Number(minYear) || 0,
          maxYear: Number(maxYear) || 0,
          minPrice: Number(minPrice) || 0,
          maxPrice: Number(maxPrice) || 0,
          maxKm: Number(maxKm) || 0,
          motorizacao,
          transmission,
          fuel,
          onlyBelowFipe,
          minFipeDiscountPct: Number(minFipeDiscountPct) || 0,
          notifyOnNew,
          notifyOnPriceDrop,
        },
        editingAlert?.id,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o alerta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <NativeDialog open={open} onClose={onClose} ariaLabelledBy={titleId}>
      <div className="w-full sm:w-[620px] max-h-[90dvh] rounded-xl border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717]">
          <div className="flex items-center gap-2">
            <BellPlus className="w-4 h-4 text-[#3ecf8e]" aria-hidden="true" />
            <h2 id={titleId} className="text-base font-semibold text-[#171717] dark:text-[#ededed]">
              {editingAlert ? 'Editar Alerta' : 'Novo Alerta de Oportunidade'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário de alerta"
            className="h-8 w-8 inline-flex items-center justify-center rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor={nameId} className="block text-xs font-medium text-[#171717] dark:text-[#ededed]">
                Nome do alerta
              </label>
              <input
                id={nameId}
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: HB20 2021 Diamond Plus até R$ 85k"
                className="w-full h-9 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label htmlFor={queryId} className="block text-xs font-medium text-[#171717] dark:text-[#ededed]">
                Palavras-chave do modelo / versão
              </label>
              <input
                id={queryId}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex.: hb20 2021 diamond plus"
                className="w-full h-9 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={brandId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Marca (opcional)
              </label>
              <input
                id={brandId}
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex.: Hyundai, Volkswagen"
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={cityId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Cidade (vazio = todas)
              </label>
              <input
                id={cityId}
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex.: Joinville"
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={minYearId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Ano mínimo
              </label>
              <input
                id={minYearId}
                type="number"
                min={1980}
                max={2030}
                value={minYear}
                onChange={(e) => setMinYear(e.target.value)}
                placeholder="Ex.: 2021"
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={maxYearId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Ano máximo
              </label>
              <input
                id={maxYearId}
                type="number"
                min={1980}
                max={2030}
                value={maxYear}
                onChange={(e) => setMaxYear(e.target.value)}
                placeholder="Ex.: 2022"
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={minPriceId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Preço mínimo (R$)
              </label>
              <input
                id={minPriceId}
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Opcional"
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={maxPriceId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Preço máximo (R$)
              </label>
              <input
                id={maxPriceId}
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Ex.: 85000"
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={maxKmId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Quilometragem máxima (km)
              </label>
              <input
                id={maxKmId}
                type="number"
                min={0}
                value={maxKm}
                onChange={(e) => setMaxKm(e.target.value)}
                placeholder="Ex.: 70000"
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={portalId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Portal
              </label>
              <select
                id={portalId}
                value={portal}
                onChange={(e) => setPortal(e.target.value)}
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              >
                <option value="">Todos os portais</option>
                <option value="OLX Carros">OLX Carros</option>
                <option value="Webmotors">Webmotors</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor={motorId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Motorização
              </label>
              <select
                id={motorId}
                value={motorizacao}
                onChange={(e) => setMotorizacao(e.target.value)}
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              >
                <option value="">Todas</option>
                <option value="turbo">Turbo</option>
                <option value="aspirado">Aspirado</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor={cambioId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Câmbio
              </label>
              <select
                id={cambioId}
                value={transmission}
                onChange={(e) => setTransmission(e.target.value)}
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              >
                {CAMBIO_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value === 'todos' ? '' : opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor={fuelId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Combustível
              </label>
              <select
                id={fuelId}
                value={fuel}
                onChange={(e) => setFuel(e.target.value)}
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              >
                <option value="">Todos</option>
                <option value="Flex">Flex</option>
                <option value="Gasolina">Gasolina</option>
                <option value="Etanol">Etanol</option>
                <option value="Diesel">Diesel</option>
                <option value="Híbrido">Híbrido</option>
                <option value="Elétrico">Elétrico</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor={minDiscountId} className="block text-xs font-medium text-[#707070] dark:text-[#a1a1aa]">
                Desconto mínimo vs FIPE (%)
              </label>
              <input
                id={minDiscountId}
                type="number"
                min={0}
                max={80}
                step="0.5"
                value={minFipeDiscountPct}
                onChange={(e) => setMinFipeDiscountPct(e.target.value)}
                placeholder="Ex.: 5 (para ≥ 5% abaixo)"
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] p-3.5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
              Regras de disparo
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyBelowFipe}
                  onChange={(e) => setOnlyBelowFipe(e.target.checked)}
                  className="accent-[#3ecf8e] rounded"
                />
                <span>Somente abaixo da Tabela FIPE</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnNew}
                  onChange={(e) => setNotifyOnNew(e.target.checked)}
                  className="accent-[#3ecf8e] rounded"
                />
                <span>Avisar em novos anúncios</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnPriceDrop}
                  onChange={(e) => setNotifyOnPriceDrop(e.target.checked)}
                  className="accent-[#3ecf8e] rounded"
                />
                <span>Avisar em quedas de preço</span>
              </label>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ededed] dark:border-[#27272a]">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs font-medium text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 inline-flex items-center gap-1.5 px-4 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              <span>{editingAlert ? 'Salvar alterações' : 'Criar alerta'}</span>
            </button>
          </div>
        </form>
      </div>
    </NativeDialog>
  );
}
