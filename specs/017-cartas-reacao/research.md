# Research: Cartas de reação (Diplomacia, Bunker Fiscal)

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION.

## R1 — Interrupção via `resolution` (2 variantes)

**Decisão**: `ResolutionSlice +=`
- `{ kind: 'reaction-diplomacia'; reactorId; attackerId; effect; cardId; deck; targetPos: number|null; targetPlayer: string|null }`
- `{ kind: 'reaction-bunker'; reactorId; amount }`

**Rationale**: o slot `resolution` já **bloqueia finalizar** e é o ponto de interação transitória. A variante guarda tudo para **aplicar** (recusa) ou **cancelar** (uso). A carta ofensiva "em voo" mora na variante (`cardId`/`deck`).

**Alternativas**: campo `pendingReaction` separado (rejeitado — duplicaria o gating; `resolution` já serve).

## R2 — Diplomacia: interceptação no `playHandCard`

**Decisão**: ao despachar uma ofensiva (boicote/aquisicaoHostil/despejo/auditoriaFiscal), calcular `reactorFor(...)`; se o reator **existe** (jogada válida) e **possui Diplomacia** (`findReactionCard`), abrir `reaction-diplomacia` (retira a ofensiva da mão do atacante, guarda em `resolution`) e retornar. Senão, aplicar como em 015/016.

**Rationale**: `playHandCard` já é o ponto de despacho das ofensivas. `reactorFor` reusa os predicados `canAcquire/canEvict/canAudit` (+ gate do Boicote) para só abrir reação em jogada **válida** (não consome carta à toa).

## R3 — `respondReaction(state, use, ports)`

**Decisão**:
- `reaction-diplomacia`: `use` → remove 1 Diplomacia da mão do reator (recicla), recicla a ofensiva, **nenhum efeito**. `!use` → `applyOffensive(...)` (acquire/evict/audit/boicote) com os dados guardados, recicla a ofensiva. Em ambos, `completeResolution`.
- `reaction-bunker`: `use` → remove 1 Bunker (recicla), **sem cobrança**. `!use` → cobra o imposto (`payer.cash -= amount` + `onPayToCenter`); se faltar caixa, abre **dívida** (008) no lugar. `completeResolution` (ou deixa a dívida).

**Rationale**: a ofensiva é "gasta" sempre (reciclada nos dois ramos). Bunker recusado replica o handler de imposto (incl. dívida do 008).

## R4 — Bunker: `taxBunkerResolve` composto no `ctx.resolve`

**Decisão**: novo resolver de cartas: se `square.kind==='tax'` e o jogador possui Bunker → `resolution = reaction-bunker{reactorId, amount}`, `{done:false, blocksFinalize:true}`; senão `null`. Composição no store: `economyResolve(r) ?? cardResolve(r) ?? taxBunkerResolve(r)` (roda **antes** do handler default de `tax`, que só dispara quando `ctx.resolve` devolve `null`).

**Rationale**: o imposto é resolvido pelo registry default (002); para interceptá-lo com um conceito de carta sem acoplar 002 a cartas, o `taxBunkerResolve` (camada cards) entra na composição do `ctx.resolve` antes do default.

## R5 — Predicados `canAcquire`/`canEvict`/`canAudit` (DRY)

**Decisão**: extrair os gates de `acquire`/`evict`/`audit` (016) para `canAcquire`/`canEvict`/`canAudit`; as funções de aplicação os chamam primeiro. `reactorFor` também os usa para decidir abrir a reação só em jogada válida.

**Rationale**: evita duplicar a validação entre a interceptação (reação) e a aplicação. O gate do Boicote (alvo de outro, não imune) é simples e fica em `reactorFor`/`canBoicote`.

## R6 — Privacidade preservada

**Decisão**: a checagem `findReactionCard(reactor, 'diplomacia')` é interna ao motor; o atacante não recebe informação sobre a mão do alvo. A reação só se materializa (e revela a Diplomacia) ao ser **usada**.

**Rationale**: §12.4 + princípio VI (o bluff da Diplomacia depende de o atacante não saber).

## R7 — Deferimentos

**Decisão**: (a) **Bunker sobre Auditoria recebida** — fora de escopo; o Bunker só intercepta casas de imposto. A Auditoria já é cancelável inteira pela Diplomacia. (b) **Timer de 10s** — UI/store (M2); o motor exige `respondReaction` explícito.

**Rationale**: a reação dupla na mesma ação (Diplomacia + Bunker sobre Auditoria) e o timer são complexidade de baixo retorno frente ao núcleo. Documentado.
