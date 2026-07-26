# Specification Quality Checklist: Leilão do espólio do falido-ao-banco

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-25
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

Duas ambiguidades foram resolvidas **antes** da spec, como decisão registrada
([D-031](../../../docs/adr/D-031-espolio-do-falido-vai-a-pregao-simultaneo.md)), não como
`[NEEDS CLARIFICATION]`: o **formato** do leilão (pregão simultâneo vs fila de leilões
comuns) e a **colisão** com um pregão de escassez já aberto (injetar vs enfileirar). O
projeto exige que refinamento de regra nasça em ADR, nunca dentro de uma spec (princípio I).

Nomes de entidade (`GameState.landAuction`, `origin`) aparecem no campo **Input** porque
fazem parte do que foi pedido, e no `plan.md` porque lá é o lugar deles. Nos requisitos e
critérios de sucesso, a linguagem é de domínio — "pregão", "lote", "origem".

Ponto de atenção para o `/speckit-plan`: **FR-019** (não leiloar o mesmo lote duas vezes) é
o requisito mais fácil de implementar por acidente e não testar. O caminho é real —
propriedade sem dono é lote de escassez, e o espólio só produz propriedades que **tinham**
dono, então a interseção deveria ser vazia; mas "deveria ser vazia" é exatamente o tipo de
invariante que um dia deixa de ser verdade em silêncio.
