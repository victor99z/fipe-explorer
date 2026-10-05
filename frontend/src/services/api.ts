import {
  VehicleSearchResponse,
  VehicleFilterParams,
  HistoryResponse,
  HistoryQueryParams,
  PresetItem,
  SuggestionItem,
  EngineSizeItem
} from '../types/vehicle';

/**
 * Centralized, typed API service for interacting with the FIPEX backend.
 */

export async function fetchBrands(tipoVeiculo: string = 'carro'): Promise<string[]> {
  const res = await fetch(`/api/filters/brands?tipo_veiculo=${encodeURIComponent(tipoVeiculo)}`);
  if (!res.ok) {
    throw new Error(`Falha ao carregar marcas: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchEngineSizes(tipoVeiculo: string = 'carro'): Promise<EngineSizeItem[]> {
  const res = await fetch(`/api/filters/engine-sizes?tipo_veiculo=${encodeURIComponent(tipoVeiculo)}`);
  if (!res.ok) {
    throw new Error(`Falha ao carregar litragens: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCars(filters: VehicleFilterParams): Promise<VehicleSearchResponse> {
  const params = new URLSearchParams();

  if (filters.tipo_veiculo) params.append('tipo_veiculo', filters.tipo_veiculo);
  if (filters.preco_min !== undefined && filters.preco_min !== '') params.append('preco_min', String(filters.preco_min));
  if (filters.preco_max !== undefined && filters.preco_max !== '') params.append('preco_max', String(filters.preco_max));
  if (filters.ano_min !== undefined && filters.ano_min !== '') params.append('ano_min', String(filters.ano_min));
  if (filters.ano_max !== undefined && filters.ano_max !== '') params.append('ano_max', String(filters.ano_max));
  if (filters.motorizacao) params.append('motorizacao', filters.motorizacao);
  if (filters.cambio) params.append('cambio', filters.cambio);
  if (filters.litragem) params.append('litragem', filters.litragem);
  if (filters.ordenacao) params.append('ordenacao', filters.ordenacao);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.combustivel) params.append('combustivel', filters.combustivel);
  if (filters.search) params.append('search', filters.search);

  if (filters.marcas && filters.marcas.length > 0) {
    params.append('marcas', filters.marcas.join(','));
  } else if (filters.marca) {
    params.append('marca', filters.marca);
  }

  const res = await fetch(`/api/search/by-price?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Falha ao buscar veículos: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchVehicleHistory(params: HistoryQueryParams): Promise<HistoryResponse> {
  const queryParams = new URLSearchParams();

  if (params.tipo_veiculo) queryParams.append('tipo_veiculo', params.tipo_veiculo);
  if (params.codigo_fipe) queryParams.append('codigo_fipe', params.codigo_fipe);
  if (params.search_term) queryParams.append('search_term', params.search_term);
  if (params.marca) queryParams.append('marca', params.marca);
  if (params.marcas) queryParams.append('marcas', params.marcas);
  if (params.modelo) queryParams.append('modelo', params.modelo);
  if (params.ano_modelo !== undefined && params.ano_modelo !== null) {
    queryParams.append('ano_modelo', String(params.ano_modelo));
  }
  if (params.motorizacao) queryParams.append('motorizacao', params.motorizacao);
  if (params.cambio) queryParams.append('cambio', params.cambio);
  if (params.groupby) queryParams.append('groupby', params.groupby);
  if (params.metrica_ano) queryParams.append('metrica_ano', params.metrica_ano);

  const res = await fetch(`/api/history?${queryParams.toString()}`);
  if (!res.ok) {
    throw new Error('Não foi possível carregar o histórico de preços deste veículo.');
  }
  return res.json();
}

export async function fetchPresets(): Promise<PresetItem[]> {
  const res = await fetch('/api/presets');
  if (!res.ok) {
    throw new Error(`Falha ao carregar presets: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSuggestions(query: string, tipoVeiculo: string = 'carro'): Promise<SuggestionItem[]> {
  const params = new URLSearchParams({
    q: query,
    tipo_veiculo: tipoVeiculo
  });
  const res = await fetch(`/api/search/suggestions?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Falha ao carregar sugestões: ${res.statusText}`);
  }
  return res.json();
}
