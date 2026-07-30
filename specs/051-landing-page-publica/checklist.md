# Checklist de qualidade — 051 (analyze + checklist)

## Consistência spec ⇄ plan ⇄ tasks (analyze)

- [x] Toda FR tem task correspondente (FR-001→T009, FR-002→T010/T011, FR-003→T001, FR-004→T002/T003/T009, FR-005→T004/T005, FR-006→T002/T007/T015, FR-007→T002/T009–T012/T021, FR-008→T017–T019, FR-009→T007, FR-010→T007/T014/T015, FR-011→T013, FR-012→T006/T015)
- [x] Nenhuma regra de jogo nova nasce aqui (sem ADR/bump de SRS — constitution I/II respeitados)
- [x] Contratos de URL auditados no código real (App/OnlineGate/session/supabaseClient/e2eScenario/store)
- [x] Nenhuma afirmação de marketing sem fonte (SRS §, código ou ADR anotados na spec)

## Gate de conteúdo (antes de publicar cada página)

- [x] Todas as mecânicas citadas existem no SRS/código
- [x] Sem matchmaking público afirmado como inexistente (explícito)
- [x] "Metrópole Neon" nunca dito jogável
- [x] Monopoly/Banco Imobiliário no máximo em 1 FAQ factual, não afiliado
- [x] Sem números/depoimentos/urgência inventados
- [x] Footer só com links reais

## Gate técnico (critério de conclusão do brief §19)

- [x] `/` prerenderizada e indexável; `/como-jogar` e `/faq` existem; `/jogar` = app atual
- [x] `/?room=` antigo funciona; links novos nascem em `/jogar?room=`
- [x] Manifest comprova bundles separados (sem Supabase/engine no marketing)
- [x] SEO técnico: metas, canonical, OG/Twitter, robots, sitemap, 404, JSON-LD ×2, GSC configurável
- [x] WCAG AA + 6 resoluções + reduced-motion verificados
- [x] lint, typecheck, vitest, build executados e reportados
