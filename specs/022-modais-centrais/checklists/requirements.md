# Specification Quality Checklist: Modais centrais (M2) — interações dirigidas por resolução

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

- **Sem [NEEDS CLARIFICATION]**: escopo decidido com o usuário = somente os cinco estados de resolução em que o motor já pausa (compra, leilão de propriedade, leilão de casas, descarte, Atalho). Decisões: nomes de comando/estado citados são contexto, não vazamento de implementação (a spec fala de "modal central", "resolução pendente"); a parte automatizável é a função pura estado→descritor (SC-005), render validado no `bun run dev`; privacidade de cartas (VI) explicitada (FR-006/SC-003). Diferidos com justificativa: revelação de carta imediata (precisa de novo estado no motor), construção/hipoteca/negociação (iniciadas pelo jogador). Pronta para `/speckit-plan`.
- **Validação visual**: por não haver RTL no projeto, o acabamento dos modais depende de conferência manual — apontado nas Assumptions.
