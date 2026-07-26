# Implementation Plan: Leilão do espólio do falido-ao-banco

**Branch**: `main` (fluxo sem branch por feature) | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification de `specs/039-leilao-espolio-falido/spec.md`

## Summary

Fechar a última lacuna de regra do SRS: propriedades de quem falir devendo ao banco vão a **pregão** em vez de voltarem de graça. O desenho é quase todo **reuso** — o pregão simultâneo da spec 031 já resolve lotes independentes com prazo próprio, trava de solvência e fecho autônomo. Esta fatia acrescenta três coisas e nada mais:

1. um discriminador de **origem** no pregão (`origin: 'scarcity' | 'bankruptcy' | 'mixed'`);
2. uma função que **abre OU injeta** lotes (`openEstateAuction`), porque o espólio pode nascer com um pregão já aberto;
3. o ponto de chamada em `declareBankruptcy`, que deixa de zerar `ownerId` quando não há herdeiro.

`placeLandBid`, `settleLot`, `closeExpiredLandLots`, `closeLandAuction` e `committedCash` ficam **intactos**. Se essa promessa quebrar durante a implementação, o desenho está errado — é o sinal de alarme desta fatia.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19

**Primary Dependencies**: nenhuma nova. Zustand (store), Vitest (testes). O motor não depende de React.

**Storage**: `GameState` serializável (snapshot Supabase). O campo `origin` é string literal — serializa sem tratamento.

**Testing**: Vitest. Motor em `tests/game/`, rede em `tests/net/`, simulação em `tests/sim/`.

**Target Platform**: browser (Vite). Motor roda igual headless (Node/Bun) — é o que permite testar convergência sem infra.

**Project Type**: SPA + BaaS. Motor puro em `src/game/**`, rede em `src/net/**`.

**Performance Goals**: o espólio inteiro resolve numa janela de `THEME.LAND_AUCTION_SECONDS` (8s), independente do tamanho (SC-002). Nenhum laço novo por frame — o pregão já tem seu timer no store.

**Constraints**:
- **Reducers puros** `(state, ctx) → state` com `structuredClone`; único efeito é o store (constitution).
- **Não-determinismo só via `ctx`**: o `now` do prazo dos lotes vem de `ctx.now`, que o `recorder` (037) grava no host e reproduz no cliente. Chamar `Date.now()` dentro do reducer quebraria a convergência (SC-006).
- **Slot único de pregão**: `GameState.landAuction` continua sendo um só. Um segundo slot foi rejeitado na D-031.
- **`GameState.resolution` não entra nisso**: o pregão é evento autônomo, como `pendingTrade`/`notice`. A falência continua chamando `advanceSeat`.

**Scale/Scope**: 1 tipo alterado, 1 função nova no motor, 1 ponto de chamada, 1 título de UI. Estimativa: ~120 linhas de produção, ~20 casos de teste.

## Constitution Check

*GATE: passou antes do Phase 0; re-checado após o design.*

| Princípio | Situação |
|---|---|
| **I — SRS é verdade absoluta** | ✅ A spec operacionaliza §9.2 + §7.2/§7.3 (v1.6). O formato, que o SRS não fixava, foi decidido em **D-031 antes** da spec — regra não nasceu aqui. |
| **II — Discovery antes de código** | ✅ ADR → SRS bump → spec → plan → tasks → implement. |
| **III — Tesouro precisa impactar** | ➖ Não se aplica (não há carta nesta fatia). |
| **IV — Catch-up é discreto** | ⚠️ **Atenção real.** O pregão do espólio é redistributivo e favorece quem tem caixa — ou seja, tende a ajudar **o líder**, não quem está atrás. Isso é consequência da regra do SRS, não um mecanismo de assistência, e a UI não rotula nada como catch-up. Registrado em D-031. Não há violação, mas o balanceamento merece medição (ver Complexity Tracking). |
| **V — Sem dependência obrigatória de cooperação** | ✅ Sem lance = lote fica livre. Ninguém é forçado a comprar nem a coordenar. |
| **VI — Privacidade de cartas** | ➖ Não se aplica. O espólio é só de propriedades; cartas em mão do falido não entram (e a 019 já limpa o que era dele). |
| **VII — Resiliência de sessão** | ✅ Os prazos dos lotes já são deslocados na retomada por `applyResume` (`commands.ts`), e os lotes do espólio são lotes iguais aos outros — herdam isso de graça. |

## Project Structure

### Documentation (this feature)

```text
specs/039-leilao-espolio-falido/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # as decisões de desenho e o que foi descartado
├── data-model.md        # o delta em GameState
├── contracts/
│   └── estate-auction.md  # contrato de openEstateAuction
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/game/
├── economy/
│   ├── types.ts          # ALTERADO: LandAuction ganha `origin`; novo tipo AuctionOrigin
│   └── landAuction.ts    # ALTERADO: openEstateAuction (nova); maybeOpenLandAuction marca origin
│                         #           settleLot / closeExpiredLandLots / placeLandBid INTACTOS
├── falencia/
│   └── falencia.ts       # ALTERADO: sem herdeiro → coleta o espólio e abre/injeta o pregão
└── commands.ts           # ALTERADO: comentário do LAND_TRIGGERING (o motivo mudou)

src/game/ui/
└── landAuction/
    └── LandAuctionLayer.tsx  # ALTERADO: título pela origem; nome do falido via identidade

tests/game/
├── falencia/
│   └── espolio.test.ts   # NOVO: o gatilho (US1) e as guardas
└── economy/
    └── landAuction.test.ts # ALTERADO: injeção no pregão aberto (US2), origem, FR-019

tests/net/
└── espolio.test.ts       # NOVO: convergência da abertura/fecho em 3 clientes (SC-006)
```

**Structure Decision**: nenhuma pasta nova. A feature vive onde a mecânica que ela reusa já vive (`economy/landAuction.ts`) e onde o gatilho nasce (`falencia/falencia.ts`). O import novo é **falência → economia**, direção que já existe no repo (`falencia.ts` importa `economy/construction`) e sem ciclo: `landAuction.ts` não conhece `falencia`.

## Decisões de design

### D1 — `origin` é atributo do pregão, não um segundo slot

`LandAuction` ganha `origin`. Descartado: um `estateAuction` paralelo — dois slots exigiriam duplicar timer, fecho, trava de solvência e camada de UI, e a D-031 já rejeitou.

`origin` tem **três** valores, não dois: `'scarcity'`, `'bankruptcy'` e `'mixed'`. O terceiro existe porque FR-020 pede que um pregão com lotes das duas origens **não minta** sobre ser de uma só. A alternativa (origem por lote, `LandLot.origin`) foi descartada: aumentaria o tipo mais reusado da mecânica para servir só a um título de tela, e o `settleLot` — que a spec promete não tocar — passaria a carregar um campo que ignora.

### D2 — `openEstateAuction` abre OU injeta, e é a única função nova

Assinatura: `openEstateAuction(state, positions, now, bankruptId) → GameState`.

Um só ponto de entrada para os dois casos (pregão fechado / pregão aberto), porque o chamador não deveria precisar saber em qual está. Guardas, na ordem:

1. `positions` vazio → no-op (FR-005).
2. Menos de 2 não-eliminados → no-op (FR-006).
3. Filtra `positions` que já são lote no pregão em curso (FR-019).
4. Pregão fechado → cria com `origin: 'bankruptcy'`. Pregão aberto → acrescenta lotes, **preserva** os prazos existentes (FR-016), recalcula `bidders` para os não-eliminados (FR-017) e promove `origin` a `'mixed'` se a origem anterior era diferente.
5. **Não** toca `landAuctionArmed` (FR-018).

### D3 — O prazo vem de `ctx.now`, e a falência é o chamador

`declareBankruptcy` já recebe `ctx`, e `ctx.now` é documentado como "relógio injetável (deadline do leilão)" — este é o uso previsto. Isso mantém a falência **atômica**: um comando, uma transição, um snapshot. É o que garante SC-006, porque o `recorder` grava o `now` consumido e o cliente reproduz o mesmo prazo.

Descartado: abrir o pregão no pós-processamento de `applyCommand` (onde `ctx.now!()` já é chamado). Exigiria que `declareBankruptcy` deixasse o estado num meio-passo — propriedades ainda no nome de um jogador já eliminado — e esse estado intermediário violaria invariantes que a simulação checa.

`ctx.now` é opcional no tipo. Usamos `ctx.now?.() ?? 0`: um prazo 0 já está expirado, então um teste que esquecer de injetar o relógio **falha na primeira asserção sobre prazo** em vez de passar silenciosamente. Mesma tolerância que `maybeOpenLandAuction` já tem.

### D4 — O que muda em `declareBankruptcy` é uma linha de decisão, não o laço

Hoje o laço faz `t.ownerId = heirId` para toda propriedade do devedor, com `heirId = null` significando "banco". Passa a: quando `heirId` é `null`, **coletar** a posição em vez de zerar o dono, e no fim chamar `openEstateAuction`. Com herdeiro, nada muda (FR-002).

Detalhe que importa: as construções continuam sendo desfeitas **antes** (§9.2 pede "sem construções"), e Hangar/hipoteca continuam preservados — o espólio herda isso do código que já existe.

Ponto que parecia delicado e **se dissolveu na implementação**: se `openEstateAuction` recusar abrir (espólio não vazio mas menos de 2 vivos — FR-006, o caso de fim de jogo), o que acontece com as propriedades coletadas? O plan original previa devolver a lista de posições aceitas para o chamador corrigir as recusadas.

Não é necessário: **um lote em pregão e uma propriedade no banco têm o mesmo estado de título** (`ownerId: null`) — o que os distingue é só estar em `landAuction.lots`. O laço já zera `ownerId`, então recusar deixa tudo exatamente onde o comportamento pré-039 deixava. A função devolve `GameState` puro e a recusa é no-op referencial. Registrado no [contrato](./contracts/estate-auction.md).

### D5 — `LAND_TRIGGERING` continua com `declare-bankruptcy`, por outro motivo

Hoje `declare-bankruptcy` está na tabela porque a falência devolvia terreno ao banco e subia a contagem de livres (re-arme do episódio). Com o espólio, isso deixa de valer no caso sem herdeiro — mas **continua valendo** em dois caminhos: falência com herdeiro não muda a contagem, e lote de espólio **sem lance** fica livre no fecho (que já dispara por `close-land-lots`). Mantemos a entrada e **corrigimos o comentário**, que ficaria mentindo. Comentário que descreve um motivo extinto é pior que comentário nenhum.

### D6 — UI: um título, zero camada nova

`LandAuctionLayer` já desenha lotes com prazo próprio. Só o cabeçalho muda, por `origin`. Para `'bankruptcy'`/`'mixed'` o título nomeia o falido — daí `LandAuction` guardar `bankruptId` (o **id**, não o nome: nome vive na sala, fora do `GameState`, por D-019; a UI resolve via `identityOf` da 038).

### D7 — Testes: onde cada requisito é provado

| Camada | Arquivo | O que prova |
|---|---|---|
| Motor — gatilho | `tests/game/falencia/espolio.test.ts` | FR-001..006, US1. Inclui as três guardas de não-abertura e o caso com herdeiro intacto. |
| Motor — pregão | `tests/game/economy/landAuction.test.ts` | FR-015..019, US2. Injeção preservando prazos, `bidders` recalculado, `origin` promovida, FR-019. |
| Rede | `tests/net/espolio.test.ts` | SC-006 sobre o `LocalHub` com 3 clientes: abertura e fecho convergem byte a byte. |
| Simulação | já cobre | O fuzzer da 036 dirige `declare-bankruptcy` e o oráculo de conservação (SC-007) passa a ver dinheiro saindo do vencedor — sem escrever caso novo, o lote aleatório valida a conservação. |

FR-019 é o que a checklist da spec marcou como armadilha: hoje a interseção deveria ser vazia (lote de escassez é propriedade **sem** dono; espólio só produz propriedades que **tinham** dono). O teste existe para o dia em que isso deixar de ser verdade em silêncio.

## Complexity Tracking

Sem violação de constitution a justificar. Um ponto de acompanhamento, não bloqueante:

| Tema | Situação | Encaminhamento |
|---|---|---|
| Princípio IV (catch-up discreto) | O espólio favorece quem tem caixa, o que empurra na direção **oposta** ao catch-up. Não é violação — é a regra do SRS, e nada na UI rotula — mas muda a curva de fim de jogo. | Medir no lote de simulação depois de implementar: o item 3 do backlog (registrar vencedor/curva de patrimônio no `report.ts`) é o pré-requisito para responder isso com dado em vez de intuição. Fora do escopo desta spec. |
