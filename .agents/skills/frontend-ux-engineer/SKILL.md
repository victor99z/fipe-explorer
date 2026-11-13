---
name: frontend-ux-engineer
description: >-
  Frontend & UX engineering runbook for fipex. Use this skill whenever auditing,
  creating, refactoring, or polishing React/Tailwind UI components, typography,
  filters, automotive data cards, modals, accessibility, or responsive layouts
  in frontend/src.
---

# Frontend & UX Engineer (fipex)

Runbook para manter a interface do **fipex** consistente, acessível, responsiva e legível para consulta de dados financeiros e automotivos (FIPE + INMETRO PBEV).

## 1. Disciplina Tipográfica & Numérica

- **Fonte principal (`--font-sans`)**: `Inter` com `font-feature-settings: "cv02", "cv03", "cv04", "cv11"`.
- **Números tabulares obrigatórios**: Todos os preços (`R$`), percentuais (`%`), anos, contagens e métricas de consumo (`km/l`, `km/le`, `MJ/km`, `km`) devem usar `Inter` + classe `.tabular-nums` (`font-variant-numeric: tabular-nums`) e formatação `pt-BR` (`toLocaleString('pt-BR')` e vírgula decimal).
- **Monospace restrita (`--font-mono`)**: Usar `JetBrains Mono` exclusivamente para códigos técnicos (ex.: `codigo_fipe` como `005476-3`, banners de query/CLI ou nomes de arquivo/dataset), nunca em preços, variações percentuais ou paginação.
- **Quebra de texto**: Aplicar `text-wrap: balance` em títulos curtos (`h1, h2, h3`) e `text-wrap: pretty` em parágrafos e listas (`p, li`).

## 2. Geometria de Tags, Badges & Controles

- **Tags de cabeçalho dos cards**: Todas na mesma linha devem compartilhar altura e alinhamento idênticos:
  `inline-flex items-center h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none`
- **Tags de cabeçalho do modal**:
  `inline-flex items-center h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none`
- **Tags do bloco INMETRO**:
  `inline-flex items-center h-6 px-2 rounded-[4px] text-[11px] leading-none`
- **Botões de barra e filtros**: Altura padronizada (`h-8`), `inline-flex items-center justify-center`, sem ícones duplicados (ex.: nunca combinar emoji `⚡` com `<Zap />`).
- **Paleta semântica Nota PBE**:
  - `A`: `bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40`
  - `B`: `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30`
  - `C`: `bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30`
  - `D` / `E`: `bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#ededed] dark:border-[#27272a]`

## 3. UX de Pesquisa, Cards & Modais

- **Feedback claro de estado ativo**:
  - Exibir a faixa de preço ativa (mínimo e máximo calculados pela faixa inteligente ou ajuste manual) ao lado do campo de orçamento.
  - Exibir contadores formatados em `pt-BR`.
- **Cards clicáveis**:
  - Todo card de veículo deve responder ao clique para abrir o histórico, com realce sutil de borda (`hover:border-[#3ecf8e]/60`) e sincronização com o botão `Ver Histórico`.
  - Evitar truncamentos ambíguos em mobile e garantir que `Ver Histórico` use `e.stopPropagation()` ou o mesmo handler sem ações duplicadas.
- **Modais (`VehicleHistoryModal`)**:
  - Fechamento ao clicar no backdrop (light dismiss) e ao pressionar `Escape`.
  - Bloqueio de scroll do `document.body` enquanto aberto (`overflow: hidden` com restauração no cleanup).
  - Atributos semânticos `role="dialog"`, `aria-modal="true"` e `aria-labelledby`.

## 4. Acessibilidade & Padrões Modernos

- Declarar `<html lang="pt-BR">` e `<title>` descritivo.
- Associar todos os `<label>` aos respectivos controles via `htmlFor` + `id`.
- Usar `aria-pressed` em pills/botões de filtro alternáveis e `aria-expanded` / `aria-haspopup="listbox"` em dropdowns.
- Aplicar `aria-hidden="true"` em ícones puramente decorativos.
- Garantir anel de foco visível apenas na navegação por teclado via `:focus-visible`.

## 5. Checklist de Validação

Após qualquer alteração no frontend:

1. Rodar `cd frontend && npm run typecheck && npm run build` e confirmar `exit code 0`.
2. Verificar no navegador ou dev server (`http://localhost:3000`):
   - Tags alinhadas com altura uniforme no card e no modal (light & dark mode).
   - Formatação numérica `pt-BR` com `tabular-nums` em preços, porcentagens e métricas INMETRO.
   - Navegação por teclado (`Tab`, `Enter`, `Escape`) e fechamento do modal ao clicar fora.
