---
name: frontend-ux-engineer
description: >-
  Frontend & UX engineering runbook for fipex following the Knolling Pastel Flat
  Lay specification (design.md). Use this skill whenever auditing, creating,
  refactoring, or polishing React/Tailwind UI components, typography, filters,
  automotive data cards, modals, accessibility, or responsive layouts in
  frontend/src.
---

# Frontend & UX Engineer (fipex — Knolling Pastel Flat Lay)

Runbook baseado em [design.md](../../design.md) (**Knolling Pastel Flat Lay**) para manter a interface do **fipex** organizada em geometria ortogonal de 90°, acessível, responsiva e legível para consulta de dados financeiros e automotivos (FIPE + INMETRO PBEV + Anúncios Joinville).

## 1. Paleta & Superfícies (Sem Preto Puro `#000000`)

- **Fundo Principal (Split Vertical 50/50)**: Blush Pastel (`#F6D0D6`) na metade esquerda e Lavanda (`#E6E6FA`) na metade direita (`.knolling-split-bg`), sem ultrapassar 80% de saturação.
- **Modo Escuro Harmonioso (`.dark`)**: Grafite/Charcoal `#2D2D2D` / `#242226` (nunca `#000000`) com acentos em tons pastel dessaturados.
- **Papel Fosco (Matte Paper Stock)**: `#FFFDFB` para cards principais, modais e barra de navegação (`1px` de borda `rgba(45,45,45,0.14)` e sombra suave `0 2px 12px rgba(0,0,0,0.06)`).
- **Compartimentos Pastel**:
  - **Sky Accent (`#CBE4F0`)**: CTAs primários, aba ativa, badges de ano/turbo e anel de foco (`2px` com offset `2px`).
  - **Soft Mint (`#D0F0C0`)**: oportunidades abaixo da FIPE, nota PBE A/B e consumo INMETRO.
  - **Lavender (`#E6E6FA`)**: grades de especificações técnicas e códigos FIPE.
  - **Blush (`#F6D0D6`)**: alertas sutis acima da FIPE, favoritos e pico máximo.
- **Texto Primário**: `#2D2D2D` (nunca `#000000`).

## 2. Disciplina Tipográfica & Numérica

- **Fonte principal (`--font-sans`)**: `Lato` (`700` para Display/Hero/Títulos, `500` para labels/captions, `400` para corpo `16px/1.6` com `max-w-[72ch]`).
- **Números tabulares obrigatórios**: Todos os preços (`R$`), percentuais (`%`), anos, contagens e métricas de consumo (`km/l`, `km/le`, `MJ/km`, `km`) devem usar `Lato` + `.tabular-nums` (`font-variant-numeric: tabular-nums`) e formatação `pt-BR`.
- **Monospace (`--font-mono`)**: `JetBrains Mono` para `codigo_fipe` (ex.: `005476-3`), índices de bandeja knolling e metadados técnicos (`DuckDB Query Engine`).
- **Quebra de texto**: `text-wrap: balance` em títulos (`h1, h2, h3`) e `text-wrap: pretty` em parágrafos (`p, li`).

## 3. Layout, Formas & Contrato de Z-Index

- **Contêiner & Viewport**: `min-h-[100dvh]` (nunca `h-screen`), `max-w-[1280px] mx-auto px-6`.
- **Raio base (`12px`)**: `rounded-xl` em botões, cards, inputs e modais; compartimentos internos com alinhamento estrito em 90°.
- **Regra contra 3 colunas iguais**: Hero em tela dividida (`split-screen`) e **grids de cards/listagens em no máximo 2 colunas** (`grid-cols-1 md:grid-cols-2`), nunca 3 colunas de largura igual.
- **Z-index contract**: base (`0`) / sticky-nav (`z-[100]`) / overlay-dropdown (`z-[200]`) / modal (`z-[300]`) / toast (`z-[500]`).
- **Skeletons (Sem spinners circulares)**: Estados de carregamento usam `.knolling-shimmer` em blocos proporcionais ao conteúdo — **proibido usar `animate-spin` / spinners circulares**.

## 4. Acessibilidade & Padrões

- Declarar `<html lang="pt-BR">` e `<title>` descritivo; zero emojis na UI (somente `lucide-react` ou SVG inline com `aria-hidden="true"`).
- Associar `<label>` acima de cada input (`htmlFor` + `id`), sem labels flutuantes.
- `aria-pressed` em toggles/pílulas, `aria-expanded` / `aria-haspopup="listbox"` em dropdowns e light dismiss (`Escape` + backdrop click) com trava de scroll em modais.
- Foco visível com anel `#CBE4F0` (`outline: 2px solid #CBE4F0; outline-offset: 2px`).

## 5. Checklist de Validação

1. `cd frontend && npm run typecheck && npm run build` com `exit code 0`.
2. Verificar no navegador (`http://localhost:3000`): ambas as abas (`Tabela FIPE` e `Anúncios Joinville`) e modais em layout knolling 2 colunas, fontes `Lato` + `JetBrains Mono`, ausência de spinners circulares e ausência de overflow horizontal.
