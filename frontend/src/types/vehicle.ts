export interface Vehicle {
  codigo_fipe: string;
  nome_marca: string;
  nome_modelo: string;
  ano_modelo: number | null;
  nome_combustivel?: string;
  valor: number;
  valor_formatado: string;
  periodo_referencia: string;
  valor_inicial?: number | null;
  valor_inicial_formatado?: string | null;
  variacao_pct?: number | null;
  litragem?: string | null;
  is_turbo?: boolean;
  is_automatico?: boolean;
  tipo_cambio?: string;
}

export interface VehicleSearchResponse {
  total_encontrados: number;
  page: number;
  total_paginas: number;
  resumo_faixa: {
    preco_min?: number | string | null;
    preco_max?: number | string | null;
    ano_min?: number | string | null;
    ano_max?: number | string | null;
    motorizacao?: string;
    cambio?: string;
    litragem?: string;
  };
  resultados: Vehicle[];
}

export interface VehicleFilterParams {
  tipo_veiculo?: string;
  preco_min?: string | number;
  preco_max?: string | number;
  ano_min?: string | number;
  ano_max?: string | number;
  motorizacao?: string;
  cambio?: string;
  litragem?: string;
  marcas?: string[];
  marca?: string;
  search?: string;
  combustivel?: string;
  ordenacao?: string;
  page?: number;
  limit?: number;
}

export interface HistoryPoint {
  periodo: string;
  ano_referencia: number;
  mes_referencia: number;
  valor: number;
  valor_formatado: string;
  valor_min: number;
  valor_max: number;
  variacao_periodo_rs: number;
  variacao_periodo_pct: number;
  variacao_acumulada_rs: number;
  variacao_acumulada_pct: number;
}

export interface HistorySummary {
  valor_inicial: number;
  valor_inicial_formatado: string;
  data_inicial: string;
  periodo_inicial: string;
  valor_atual: number;
  valor_atual_formatado: string;
  data_atual: string;
  periodo_atual: string;
  valor_minimo: number;
  valor_minimo_formatado: string;
  data_minimo: string;
  valor_maximo: number;
  valor_maximo_formatado: string;
  data_maximo: string;
  variacao_total_rs: number;
  variacao_total_rs_formatada: string;
  variacao_total_pct: number;
  variacao_pct: number;
  tendencia: 'valorizou' | 'desvalorizou' | 'estavel' | string;
  cagr_pct: number;
}

export interface HistoryInfo {
  tipo_veiculo: string;
  nome_marca: string;
  nome_modelo: string;
  codigo_fipe: string;
  ano_modelo?: number | null;
  total_registros_brutos: number;
  periodo_inicial: string;
  periodo_final: string;
}

export interface HistoryResponse {
  info: HistoryInfo;
  summary: HistorySummary;
  series: HistoryPoint[];
}

export interface HistoryQueryParams {
  tipo_veiculo?: string;
  codigo_fipe?: string;
  search_term?: string;
  marca?: string;
  marcas?: string;
  modelo?: string;
  ano_modelo?: number | string | null;
  motorizacao?: string;
  cambio?: string;
  groupby?: 'mes' | 'ano' | string;
  metrica_ano?: 'media' | 'fechamento' | 'max' | 'min' | string;
}

export interface PresetItem {
  id: string;
  title: string;
  subtitle: string;
  tipo_veiculo: string;
  search_term: string;
  ano_modelo: number;
  badge: string;
}

export interface SuggestionItem {
  codigo_fipe: string;
  nome_marca: string;
  nome_modelo: string;
  anos: number[];
}

export interface EngineOption {
  id: string;
  label: string;
}

export interface EngineSizeItem {
  litragem: string;
  total_modelos: number;
}

