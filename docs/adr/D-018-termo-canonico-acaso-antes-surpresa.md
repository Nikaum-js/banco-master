# D-018 — Termo canônico "Acaso" (antes "Surpresa")

**Data:** 2026-05-23 · **Status:** aceita
**Decisão:** O espaço de tabuleiro e o deck de cartas caóticas/ofensivas passam a se chamar **"Acaso"** (era "Surpresa"). "Tesouro" permanece. O `SquareKind` canônico é `'acaso'`.
**Por quê:** O código já migrou para "Acaso" (commits de board) e o termo é mais limpo — espelha o "Chance" clássico; o próprio glossário do SRS já glosava Surpresa como "cartas de acaso". Alinha a fonte de verdade à direção de produto demonstrada.
**Como aplicar:** Propagação **incremental** para não churnar a discovery:
- **Feito agora:** `spec.md` (002) FR-010; glossário SRS §17 (registro do termo canônico); constitution Princípio III (clarificação de termo, bump PATCH 1.0.0 → 1.0.1).
- **Deferido para a spec de Sistema de Cartas:** find-replace de "Surpresa" → "Acaso" em SRS §2.1/§4.6/§10/§13.4 e em `docs/CARTAS.md` (a spec reescreve §10 de qualquer forma).
- O **001** (spec/data-model/research) fica como histórico; não reabrir (aprovada).
