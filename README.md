# FIPEX Explorer 🚗💨
> Visualizador Analítico e Consultor de Orçamento para a Tabela FIPE (9.42M de registros históricos em Parquet com DuckDB e UI inspirada no Supabase).

Agradecimento especial ao [alanwgt/fipex-veiculos-brasil](https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil) no Hugging Face pelo dataset FIPE atualizado.

---

## ⚡ Ganhos de Performance & Otimizações

A aplicação foi migrada de um modelo de expressões regulares em tempo de consulta para um **formato analítico pré-calculado e indexado em Parquet com compressão Zstandard**, resultando em ganhos massivos de desempenho:

| Métrica | Antes (Regex em tempo de execução) | Depois (Colunas Nativas Pré-calculadas) | Ganho / Melhoria |
| :--- | :--- | :--- | :--- |
| **Consulta CTE com Paginação** | ~1.439 ms (1,44 s) | **41,7 ms** (0,04 s) | **~34,5x mais rápido** |
| **Filtro Direto no Dataset** | ~1.175 ms (1,17 s) | **7,2 ms** | **~162x mais rápido** |
| **Tempo Total Requisição HTTP** | ~1.600 ms | **~49 ms** | **Instantâneo (< 50ms)** |
| **Tamanho do Arquivo Parquet** | 121,00 MB | **58,63 MB** (ZSTD) | **Redução de 51,5%** |
| **CPU e Alocação de Memória** | Alta (múltiplas regexes por linha) | Mínima (filtros binários/numéricos) | **Extremamente leve** |

---

## 🛠️ Detalhes das Otimizações Implementadas

### 1. Script de Enriquecimento: `scripts/enrich_parquet.py`
- Processou **9.427.367 linhas** em apenas **9,07 segundos** utilizando DuckDB com processamento paralelo (4 threads).
- Gerou o novo dataset comprimido: `data/fipex-prices-enriched.parquet` (58,63 MB).
- Pré-calculou as seguintes colunas nativas no arquivo Parquet:
  - `is_turbo`: `BOOLEAN` (1.028.575 registros marcados como True)
  - `is_automatico`: `BOOLEAN` (1.233.209 registros marcados como True)
  - `is_manual`: `BOOLEAN` (503.762 registros marcados como True)
  - `litragem`: `VARCHAR` (ex: `"1.0"`, `"1.4"`, `"2.0"`)
  - `litragem_num`: `DOUBLE` (ex: `1.0`, `2.0`, permitindo operadores numéricos como `litragem_num >= 2.0`)

### 2. Otimização do Backend: `server.py`
- **Detecção Inteligente do Schema (`IS_ENRICHED`)**:
  Detecta e prioriza automaticamente `data/fipex-prices-enriched.parquet`. Se o arquivo enriquecido não for encontrado, mantém fallback transparente para o arquivo original.
- **Filtros Nativos SQL**:
  - `motorizacao == "turbo"` ➔ `is_turbo = true`
  - `motorizacao == "aspirado"` ➔ `is_turbo = false`
  - `cambio == "automatico"` ➔ `is_automatico = true`
  - `cambio == "manual"` ➔ `is_manual = true`
  - `litragem == "2.0+"` ➔ `litragem_num >= 2.0`
  - `litragem == "1.0"` ➔ `litragem = '1.0'`
- **Remoção de Regex em `/api/filters/engine-sizes`**:
  Agrupamento direto pela coluna `litragem` indexada.
- **Eliminação de Regex no Pós-Processamento Python**:
  O DuckDB projeta diretamente `litragem`, `is_turbo`, `is_automatico` e `is_manual`, eliminando o loop de `re.search` por linha antes da serialização JSON.

### 3. Padronização Visual dos Dropdowns: `CustomDropdown.jsx`
- **Eliminação de `<select>` nativos do sistema**:
  Substituídos todos os elementos de seleção HTML nativos (que abriam popups do sistema operacional com realce azul genérico) por componentes de popover com o tema Supabase.
- **Dropdown "Ano a partir de"**:
  Menu flutuante elegante com bordas `#27272a`, sombra elevada, hover refinado e checkmark esmeralda (`#3ecf8e`) na opção selecionada.
- **Dropdown "Motor (+ Outras)"**:
  Menu flutuante com campo de busca integrado (`searchable`) para filtrar instantaneamente entre as mais de 65 cilindradas disponíveis no dataset. Quando uma opção alternativa é selecionada, o botão trigger assume o estilo ativo (`Motor 1.5`, etc.).
- **Dropdown "Ordenar por"**:
  Padronizado com o mesmo design flutuante.

### 4. Correção da Variação Total: `VehicleHistoryModal.jsx`
- Corrigida a extração da métrica de variação no modal de histórico de preços para suportar tanto `variacao_total_pct` quanto `variacao_pct`.
- Ajustadas as referências de data inicial e atual (ex: `Ref: 06/2019` em vez de apenas `"Início"`).

### 5. Correção de Falsos Positivos de Turbo (ex: Kwid Outsider)
- O padrão regex anterior de turbo continha `tsi` sem delimitadores de palavra (`\b`). Com isso, a palavra `"ouTSIder"` (de modelos como *Kwid Outsider*) e `"CT200h"` (Lexus) eram capturadas incorretamente como turbo.
- O padrão foi corrigido para utilizar limites estritos de palavra `\b([0-9]+)?tsi\b`, `\bt200\b`, etc., eliminando mais de 11.000 falsos positivos e reclassificando o Kwid Outsider como **Aspirado Manual** legítimo.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Python 3.10+
- Node.js 18+

### 1. Backend (FastAPI + DuckDB)
```bash
# Instalar dependências (caso não estejam instaladas)
pip install -r requirements.txt

# (Opcional) Gerar o dataset enriquecido de alta performance
python scripts/enrich_parquet.py

# Iniciar o servidor da API
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
A API estará acessível em `http://localhost:8000`.

### 2. Frontend (React + Vite + Tailwind)
```bash
cd frontend
npm install
npm run dev
```
A interface do usuário estará acessível em `http://localhost:3000` (ou `http://localhost:5173`).

---

## 📋 Checklist de Produção (Roadmap)

- [x] **Fase 4: Pré-computação e Otimização de Performance (CONCLUÍDA)**
  - [x] Criar script de enriquecimento `scripts/enrich_parquet.py`
  - [x] Gerar `data/fipex-prices-enriched.parquet` (58.6 MB compactado em ZSTD)
  - [x] Atualizar `server.py` com filtros nativos booleanos e numéricos
  - [x] Eliminar regex no loop de pós-processamento Python
  - [x] Padronizar todos os dropdowns de filtro com o design system Supabase
  - [x] Benchmarks e validação de contratos da API
- [ ] **Fase 1: Segurança e Otimização do Backend**
  - [ ] Restringir CORS no FastAPI (apenas seu domínio de produção e métodos GET)
  - [ ] Rate Limiting (anti-abuso de CPU por IP com `slowapi`)
  - [ ] Validações estritas de entrada (`limit <= 100`, etc.)
  - [ ] Cache em memória (`@lru_cache`) para metadados estáticos (`/brands`, `/engine-sizes`)
  - [ ] Desativar `/docs` em produção
  - [ ] Limites de memória e threads do DuckDB (`memory_limit = 1.5GB`, `threads = 2`)
- [ ] **Fase 2: Build e Empacotamento**
  - [ ] Executar `npm run build` do frontend
  - [ ] Definir arquivo Parquet como somente leitura (`chmod 444`)
  - [ ] Rodar container como usuário não-root
- [ ] **Fase 3: Infraestrutura (VPS + Caddy/Nginx + Cloudflare)**
  - [ ] Provisionar VPS (2 vCPU, 2-4GB RAM)
  - [ ] Configurar Uvicorn multi-worker (`--workers 2 --proxy-headers`)
  - [ ] Configurar Caddy para servir assets estáticos diretamente e proxy reverso para `/api`
  - [ ] Ativar Cloudflare com proteção DDoS e SSL universal
