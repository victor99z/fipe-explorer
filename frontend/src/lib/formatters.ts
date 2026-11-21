export function formatBRL(value: number | null | undefined, fallback = 'Sob consulta'): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function formatSignedBRL(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
    return 'R$ 0';
  }
  const sign = value > 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })}`;
}

export function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatMileageKm(km: number | null | undefined): string {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) {
    return '—';
  }
  return `${km.toLocaleString('pt-BR')} km`;
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShortBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function normalizeSearchText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function inferPortalName(ref: string): string {
  const lower = (ref || '').toLowerCase();
  if (lower.includes('olx.com.br')) return 'OLX Carros';
  if (lower.includes('webmotors.com.br')) return 'Webmotors';
  return 'Outro portal';
}
