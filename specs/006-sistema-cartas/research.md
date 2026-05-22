# Research — Sistema de Cartas (Fase 0)

Decisões técnicas. Nova camada `cards/` integrada por composição.

---

## D1 — Decks como arrays de ids; cartas como catálogo de dado

- **Decisão:** `GameState.decks = { acaso: string[]; tesouro: string[] }` (ids ordenados; topo = índice 0). O catálogo (`catalog.ts`) mapeia `id → { deck, rarity, mode, timing, effect, status }`. O baralho inicial expande as cópias (ex.: Aquisição Hostil ×2 → 2 ids).
- **Rationale:** ids serializáveis; o conteúdo da carta é dado estático (como o board). Saque = `shift`, volta ao fundo = `push`.
- **Alternativas:** objetos-carta no estado — rejeitada: duplicaria o catálogo e incharia o snapshot.

## D2 — Registry carta→handler (efeitos como dado + handler)

- **Decisão:** cada `EffectId` mapeia para um handler puro `(state, ctx, playerId) → state`. O catálogo referencia o `EffectId`. Handlers autocontidos implementados; deferidos = `noopDeferred` (volta ao fundo, sem efeito).
- **Rationale:** evita `switch` gigante; o ponto de extensão dos efeitos deferidos é um só (trocar o handler). Espelha o registry de resolução do 002.
- **Alternativas:** lógica inline no saque — rejeitada: vira o acoplamento de todas as cartas.

## D3 — Integração com o 002 por composição de `ctx.resolve`

- **Decisão:** o `cardResolve(rctx)` trata `acaso`/`tesouro` (saca e aplica/entrega à mão); o store compõe `resolve = (r) => economyResolve(r) ?? cardResolve(r)`. Cada resolver devolve `null` para `kind` que não é seu.
- **Rationale:** não reabre 002/003; o 002 já chama `ctx.resolve` antes do registry default.
- **Alternativas:** registrar no `resolutionRegistry` global — rejeitada: mutação global, pior para teste.

## D4 — Interações que exigem escolha → `ResolutionSlice` de carta

- **Decisão:** duas variantes novas: `{ kind: 'card-discard'; deckId; drawnId }` (mão cheia: escolher 1 das 4 para descartar) e `{ kind: 'card-shortcut' }` (Atalho: escolher ±3). Comandos `discardCard(id)` e `chooseCardShortcut(dir)` concluem (via `completeResolution`).
- **Rationale:** reusa o padrão de resolução pendente da 003 (compra/leilão) — o turno fica pendente até a escolha.
- **Alternativas:** auto-resolver (descartar a mais antiga; Atalho sempre à frente) — rejeitada: o SRS dá a escolha ao jogador.

## D5 — Patrimônio líquido (clarificação)

- **Decisão:** `netWorth(state, playerId) = cash + Σ preço(propriedades não-hipotecadas) + Σ preço/2 (hipotecadas) + Σ custo(construções)`. Usado por Crise Imobiliária (5%). Exposto para reuso (Auditoria/GO Progressivo futuras).
- **Rationale:** clarificação aprovada (padrão Monopoly).

## D6 — Embaralhar com RNG injetável

- **Decisão:** `shuffle(ids, rng)` (Fisher-Yates) usa o `ctx.rng` do 002. Semente controlada → testes determinísticos.
- **Rationale:** princípio VII (reconstruível) + testabilidade.

## D7 — Simplificações documentadas (efeitos com alvo/estado)

- **Decisão:** **Refinanciamento** (sem alvo explícito no SRS) deshipoteca a **primeira** propriedade hipotecada do jogador a 5%; se não houver, no-op (§10.6 nota). **Investidor Anjo** marca `nextPurchaseDiscount = 0.2`, consumido na próxima compra (003). Efeitos de Tesouro/cash são instantâneos.
- **Rationale:** mantém efeitos jogáveis sem alvo interativo extra; coerente com "carta sem estado aplicável = no-op + volta ao fundo".

---

## Catálogo — status de implementação

| Implementado (autocontido) | Deferido (subsistema novo) |
|---|---|
| Boom Econômico, Erro do banco, Aniversário, Honorários, Crise Imobiliária, Conserto de Imóveis | Aquisição Hostil, Despejo, Auditoria Fiscal (ofensivas c/ alvo) |
| Volta para o GO, Vá direto p/ Prisão, Avance 3, Volte 3, Atalho (escolha) | Diplomacia, Bunker Fiscal (reação) |
| Saia da Prisão (mão/preso), Investidor Anjo, Refinanciamento, Passagem de Ônibus | Boicote, Imunidade Temporária, Apagão, Greve nas Utilidades (temporários N voltas) |

Nenhum `NEEDS CLARIFICATION` pendente (patrimônio resolvido no clarify).
