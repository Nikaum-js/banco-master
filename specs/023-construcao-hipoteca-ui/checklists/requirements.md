# Specification Quality Checklist: UI de construção e hipoteca (M2)

**Created**: 2026-05-24 · **Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes
- [x] No implementation details leak into specification

## Notes

- **Sem [NEEDS CLARIFICATION]**: acesso decidido com o usuário = clique na propriedade no tabuleiro (popover existente ganha ações). Regras todas já no motor (004/005/011); a spec só as operacionaliza na UI. Decisões registradas: ações só para o jogador da vez (motor gateia por `activePlayer`); uniformidade torna "Construir" pos-específico (habilita na cidade de menor nível); `BuildingMark`/`MortgageMark` passam a ler estado real; parte testável = seletor puro `deedView`. Diferidos com justificativa: gatilho do leilão por escassez, trade, painel-lista. Pronta para `/speckit-plan`.
- **Validação visual**: sem RTL no projeto → acabamento dos popovers conferido no `bun run dev`.
