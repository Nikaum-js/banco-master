# D-007 — GO Progressivo

**Data:** 2026-05 · **Status:** aceita, **REVISTA pós-playtest (2026-05-24)**
**Refinada por:** [D-076](D-076-rebalanceamento-economico-para-mesas-de-3-e-4.md) — a regra continua fixa, com valores atuais de $250/$500.
**Decisão original:** Valor recebido ao passar pelo GO escala inversamente com ranking de patrimônio: $100 (1º) a $400 (último).
**Por quê (original):** Catch-up natural sem destaque na UI.
**Revisão (2026-05-24):** o GO Progressivo foi **substituído por regra fixa** (feedback de playtest — o valor variável por ranking confundia e parecia "pouco"): **passar pelo GO = $200**; **cair EXATAMENTE no GO = $400** (em dobro). Implementado em `THEME.GO_PASS` + `advance` (dobra ao parar em pos 0) + carta "Volta para o GO" (Acaso) que teleporta ao GO e credita os $400. O catch-up fica por conta do Free Parking (D-006) e tuning futuro.
