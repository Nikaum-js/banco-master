# D-028 — Bus Tickets negociáveis

**Data:** 2026-07-24 · **Status:** aceita
**Decisão:** Bus Tickets podem entrar em propostas de negociação, como contador de cada lado (0..N do que o dono possui). Cartas em mão seguem não-negociáveis ([D-011](D-011-cartas-em-mao-privadas-e-nao-negociaveis.md), inalterada).
**Por quê:** Ticket é item de MOVIMENTO com valor tático claro — moeda de barganha natural que amplia a superfície de negociação (mesmo espírito da imunidade, [D-010]). A razão de D-011 (carta como alavanca estratégica secreta) não se aplica: o contador de tickets já é público. SRS §8.2 e §10.7 atualizados (v1.4).
**Como aplicar:** `Trade` ganha `fromBusTickets`/`toBusTickets` (opcionais, ≥ 0); `validateTrade` exige posse suficiente; `applyTrade` transfere os contadores (sem taxa). UI: stepper por lado no compositor, carga no prato da balança (sem peso — tickets não têm preço de tabela), chips no modal recebido e no painel lateral.
