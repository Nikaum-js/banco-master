# Contract — Sistema de Cartas (Fase 1)

Funções puras, o resolver de carta (porta do 002) e os comandos.

---

## 1. Decks e mão (`decks.ts` / `hand.ts`)

```ts
shuffle(ids: string[], rng: RNG): string[]        // Fisher-Yates determinístico
drawTop(state, deckId): { id: string; state }     // tira do topo
returnToBottom(state, deckId, id): state           // volta ao fundo

handCount(state, playerId): number                 // visão pública (privacidade)
addToHand(state, playerId, id): state               // se >3 → abre card-discard
discard(state, playerId, id): state                 // manda ao fundo do deck do id
```

## 2. Resolver de carta (porta `drawCard` do 002)

```ts
cardResolve(rctx: ResolveCtx): ResolutionOutcome | null
//  square.kind 'acaso' | 'tesouro' → saca a carta do topo:
//     imediato → aplica efeito (registry) + volta ao fundo → { done: true }
//                (se o efeito abrir escolha — Atalho — → { done: false } com slice card-shortcut)
//     mão      → addToHand; se mão cheia → { done: false } com slice card-discard
//  outros kinds → null (cai no economyResolve / registry do 002)
```

O store compõe: `resolve = (r) => economyResolve(r) ?? cardResolve(r)`.

## 3. Registry de efeitos (`effects.ts`)

```ts
type EffectHandler = (state, ctx, playerId) => GameState
const effects: Record<EffectId, EffectHandler>

netWorth(state, playerId): number   // caixa + preços (hipotecada ÷2) + custos de construção
```

**Implementados (autocontidos):** `boomEconomico` (+200 todos), `erroBanco` (+200), `aniversario` (cada outro paga 50 → você), `honorarios` (−50 → centro), `criseImobiliaria` (todos −5% netWorth → centro), `consertoImoveis` (−25/casa −100/hotel → centro), `voltaGo` (→pos 0 +bônus), `vaPrisao` (→prisão sem GO), `avance3`/`volte3` (move ±3 via 002), `atalho` (escolha ±3 → slice), `saiaPrisao` (mão/preso → 002), `investidorAnjo` (`nextPurchaseDiscount=0.2`), `refinanciamento` (deshipoteca 1ª hipotecada a 5% — 005), `passagemOnibus` (`busTickets += 1`).

**Deferidos (`noopDeferred`):** aquisicaoHostil, despejo, auditoriaFiscal, diplomacia, bunkerFiscal, boicote, imunidade, apagao, greveUtilidades.

## 4. Comandos (store)

| Comando | Pré-condição | Efeito |
|---|---|---|
| `playHandCard(id)` | carta na mão do ativo + janela de timing ok | aplica o efeito; carta ao fundo (no-op se fora da janela) |
| `discardCard(id)` | `resolution.kind === 'card-discard'` | descarta a carta escolhida (das 4) → fundo; conclui |
| `chooseCardShortcut(dir)` | `resolution.kind === 'card-shortcut'` | move ±3 (002) e resolve a casa; conclui |

> "Saia da Prisão" também é acessível pela opção `card` do turno de prisão do 002 (FR-010).

## 5. Integração com outras specs

- **Compra (003):** `purchase.ts` aplica `nextPurchaseDiscount` ao preço e o zera após a compra (Investidor Anjo).
- **Deshipoteca (005):** Refinanciamento chama uma deshipoteca a 5% (variante de `unmortgageProperty`).
- **Movimento/prisão (002):** cartas de movimento reusam `advance`/jail.
- **Construção (004):** Conserto e netWorth leem `houses/hotel`.

## 6. Conformidade

- **Determinismo:** embaralhar/saque com RNG injetável; efeitos puros.
- **Serialização:** decks/mão = ids; contadores = números; sem refs.
- **Privacidade (princípio VI):** a única leitura pública da mão é o **contador**.
- **Não-reabertura:** integra por composição (`ctx.resolve`) e chamadas a funções puras; 002–005 ganham só a edição de desconto em `purchase.ts`.
- **Fronteira:** uso de Bus Ticket, negociação e os efeitos deferidos ficam fora.
