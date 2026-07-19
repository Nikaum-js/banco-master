# Specification Quality Checklist: Vitrine de probabilidades dos baralhos

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-30
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

Zero marcadores de clarificação: as seis ambiguidades reais foram resolvidas **por fonte**
(SRS §10.3, D-037, D-064, spec 029, `catalog.ts`) e estão registradas na tabela de
Clarifications da spec, não deixadas em aberto.

Duas observações sobre o checklist em si, para quem revisar:

- **"No implementation details"** passa com uma ressalva consciente: a spec cita `GameState`,
  `catalog.ts` e `cardMeta.ts` nomeadamente. Isso não é vazamento de implementação — é a
  **fronteira de privacidade** (FR-002/SC-005) e a **fonte única de texto** (FR-007). Ambas são
  requisito de produto derivado da D-037 e da spec 029; descrevê-las sem nomear o artefato
  tornaria o requisito não-verificável, o que falharia o item "testable and unambiguous".
- **FR-006** (`status: 'deferido'`) cobre um caso que hoje não existe (as 39 cartas estão
  `implementado`). Foi mantido de propósito: o campo existe no catálogo, e uma vitrine que
  listasse efeito não implementado mentiria sobre o jogo no dia em que alguém usar o campo.
