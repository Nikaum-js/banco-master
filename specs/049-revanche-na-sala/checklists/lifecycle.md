# Checklist de requisitos — Ciclo de revanche

**Purpose**: validar qualidade, completude e verificabilidade dos requisitos de ciclo, autoridade e recuperação
**Created**: 2026-07-29
**Feature**: [spec.md](../spec.md)

## Fronteira entre sala e partida

- [x] CHK001 O que permanece entre partidas está enumerado sem depender de interpretação? [Completeness, Spec §FR-008]
- [x] CHK002 O que deve ser recriado está enumerado e inclui estados econômicos, temporários e de apresentação? [Completeness, Spec §FR-012]
- [x] CHK003 O início automático está explicitamente proibido? [Clarity, Spec §FR-010]
- [x] CHK004 A relação entre classificação aberta localmente e lobby canônico está definida? [Consistency, Spec §FR-003–FR-006]

## Autoridade e concorrência

- [x] CHK005 Está inequívoco que somente o host reabre canonicamente e inicia? [Clarity, Spec §FR-005–FR-009]
- [x] CHK006 Cliques concorrentes ou repetidos têm requisito de idempotência? [Edge case, Spec §FR-007]
- [x] CHK007 O comportamento de convidado antes do retorno do host está definido? [Coverage, Spec US1-1]
- [x] CHK008 O comportamento de quem ainda lê o resumo quando a revanche começa está definido? [Coverage, Spec §FR-020]

## Persistência e ordenação

- [x] CHK009 Existe critério explícito para distinguir gerações da mesma sala? [Completeness, Spec §FR-014]
- [x] CHK010 Mensagens e snapshots atrasados têm comportamento verificável? [Measurability, Spec §FR-015]
- [x] CHK011 Reload está coberto antes da reabertura, no lobby e durante a revanche? [Coverage, Spec §FR-016–FR-018]
- [x] CHK012 Falha de persistência não pode anunciar sucesso apenas localmente? [Reliability, Spec §FR-024]
- [x] CHK013 O acesso ao resultado encerrado respeita assento e privacidade? [Security, Spec §FR-018–FR-019]

## Apresentação e acessibilidade

- [x] CHK014 A diferença entre CTA online e local está especificada? [Clarity, Spec §FR-001–FR-002]
- [x] CHK015 O conteúdo mínimo da classificação final está enumerado? [Completeness, Spec §FR-021]
- [x] CHK016 A viewport estreita possui critério objetivo de ausência de rolagem horizontal? [Measurability, Spec §FR-022]
- [x] CHK017 Teclado, nome acessível e foco visível estão cobertos? [Accessibility, Spec §FR-023]

## Cenários e liberação

- [x] CHK018 Duas partidas sequenciais são exigidas como prova de reset completo? [Testability, Spec §FR-025]
- [x] CHK019 Compatibilidade com salas legadas está tratada nas premissas e no plano? [Compatibility, Plan D6]
- [x] CHK020 Os gates de release estão mensuráveis e alinhados ao CI existente? [Release readiness, Spec §SC-006]

## Notes

- Todas as perguntas foram respondidas pela spec, pelo contrato e pelo data model.
- Não há marcador `[NEEDS CLARIFICATION]`.
