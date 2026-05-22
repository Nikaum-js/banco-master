# Banco Master — Milestones

> Roadmap macro até a v1.0. Lista **o que** falta, não **como** fazer.
> **Abordagem real:** desenvolvimento **vertical por feature** com GitHub Spec Kit — cada feature percorre `spec → plan → tasks → implement` (com testes) antes da próxima. Não é waterfall (specs todas, depois planos todos).
> Cada feature vive em `specs/NNN-*/`. Decisões em [`DECISIONS.md`](./DECISIONS.md); regras em [`SRS.md`](./SRS.md).

---

## M0 — Discovery & Mockup ✅

- ✅ Constitution (princípios I–VII) e SRS v1.2 consolidados
- ✅ ADRs aceitas e rejeitadas registradas em DECISIONS.md (até D-018)
- ✅ Catálogo de cartas rascunhado em CARTAS.md
- ✅ Spec Kit instalado e configurado
- ✅ Design System "Café Coado" (tokens, tipografia, paleta de grupos)
- ✅ Mockup visual do tabuleiro Clássico (dados estáticos)
- ✅ HUD **mockado** (visual): jogadores, dados, Speed Die, Pote de Férias, log, efeitos ativos

---

## M1 — Motor de jogo (lógica) ✅ (single-player; 2 regras multiplayer movidas ao M3)

Lógica de jogo **pura, serializável e testada** em `src/game/` (Zustand + Vitest). Cada item abaixo é uma feature SDD completa (`spec→plan→tasks→implement`).
**Estado: 234 testes verdes (`bunx vitest run tests/game`). Motor completo para uma partida single-player (turno, economia, construção, cartas — 0 no-op, tema, §8.4, §9.3/§9.4). Auditoria SRS×código (2026-05-24) confirmou as regras de turno/economia/cartas; resta 1 regra que só faz sentido com vários jogadores — leilão dos bens do falido-ao-banco (§9.2) — realocada para o M3. _(2026-05-25: escassez de construção + leilão de casas §5.4 **removidos**; construção ilimitada — [D-022](DECISIONS.md).)_**

### Feito

- ✅ **001 Tabuleiro & Casas** — estrutura de 48 casas (SRS §2) + render estático do board
- ✅ **002 Fluxo de Turno** — FSM pura: rolar/mover/resolver/finalizar, duplas, prisão, Speed Die; resolução por portas
- ✅ **003 Compra & Aluguel** — compra/recusa, leilão (timer), aluguel escalonado por posse; introduz **caixa** e **títulos**
- ✅ **004 Construção** — casas/hotel, uniformidade, grupo parcial (70%) _(estoque do banco/leilão de casas removidos — D-022)_
- ✅ **005 Hipoteca** — hipotecar/deshipotecar (metade + 10%), regra de transferência
- ✅ **006 Sistema de Cartas** — 2 decks (Acaso/Tesouro), raridades, mão (limite 3, privada), saque, timing, 14 efeitos autocontidos + framework; **D-018** propagado (Surpresa→Acaso)
- ✅ **007 Balanceamento/Catch-up** — GO Progressivo + Free Parking (pote); imposto/multa de prisão debitam de fato
- ✅ **008 Falência & Fim de jogo** — dívida pendente (pagar/falir), destino dos ativos (§9.2), eliminação, vitória
- ✅ **009 Bus Tickets** — *uso* do ticket (mover pelo lado, §10.7) + espaço Bus Ticket concede +1 (§2.7); contador já existia (006/D-012)
- ✅ **010 Empréstimos** — solicitar na dívida pendente, juros simples por GO, quitar (só principal), máx. 1 ativo/devedor; **destrava a Falência §9.3** (credor do empréstimo herda ativos+passivos)
- ✅ **011 Construção avançada** — 2º hotel (§14, **cobra mais aluguel** que o 1º — D-022), Hangar (§13.6, dobra aluguel do aeroporto), Skyscraper (§13.7, grupo completo, aluguel fixo + ×3 no grupo); ladder 0–7
- ✅ **012 Tax Man** (§13.8) — Fiscal do banco move a cada turno (porta em `advanceSeat`) e cobra do dono o aluguel da casa onde para (removido da economia); catch-up discreto. **Fecha as mecânicas de balanceamento.**
- ✅ **013 Negociação — troca** (§8.1–§8.3) — `executeTrade`: trocar propriedades (incl. hipotecadas, taxa de 10%) + caixa entre dois jogadores, a qualquer momento; cartas/Bus Tickets/construções não-negociáveis
- ✅ **014 Imunidade de aluguel** (§8.4 / D-010) — concedida na troca, por N voltas ou permanente; beneficiário não paga (pessoal); expira no GO; visível no HUD. **Negociação completa** (transferência de imunidade existente entregue no 028)
- ✅ **015 Cartas — efeitos temporários** (§10.6) — Apagão (Hangares off), Greve (utilidades $0), Boicote (propriedade sem aluguel), Imunidade Temporária (não-alvo); `GameState.tempEffects` + expiração no GO; respeitado por aluguel e Tax Man
- ✅ **016 Cartas ofensivas com alvo** (§10.6) — Aquisição Hostil (força venda, ×1,5 aeroporto/utilidade), Despejo (demole casa), Auditoria Fiscal (10% do patrimônio ao pote); respeitam Imunidade Temporária
- ✅ **017 Cartas de reação** (§10.6/§12.4) — Diplomacia (cancela ofensiva; atacante perde a carta) e Bunker Fiscal (cancela imposto); interrupção via `resolution`. **Sistema de cartas COMPLETO — 0 cartas no-op.**
- ✅ **018 Tema "Cidades do Mundo"** — valores oficiais centralizados em `src/game/theme.ts` (fonte única, tunável); nomes de casa únicos; ficha em `docs/TEMA.md`.
- ✅ **019 Limpeza na eliminação** (§9.4) — `declareBankruptcy` remove imunidades concedidas/recebidas e `tempEffects` originados pelo eliminado; `Immunity` ganha `granterId`. **M1 (motor) completo.**

### Pendente (engine)
- ✅ **Transferência de imunidade existente** (§8.4 "transferíveis") — entregue no **028** (re-atribui beneficiário, preserva voltas/`granterId`).
- ⤳ **Leilão dos bens do falido-ao-banco** (§9.2): hoje as propriedades voltam **direto** ao banco (grátis); o SRS pede **leilão**. Precisa de licitantes = vários jogadores → **movido ao M3**.
- ❌ **Leilão de casas em escassez** (§5.4): **removido** (2026-05-25, [D-022](DECISIONS.md)) — construção é ilimitada, não há escassez de casas. Spec 026 descontinuada.
- [ ] **Rebalanceamento pós-playtest** (tuning dos knobs em `theme.ts`).

---

## M2 — UI jogável (wiring motor ↔ tela) ✅ (falta validação visual)

O salto para **jogar de verdade**. O **HUD inferior** (`GameHUD`) já consome o store e dirige o turno (rolar/comprar/leilão/dívida/cartas/reação/Bus Ticket/empréstimo). Fatias por feature SDD:

- ✅ **020** — `PlayersPanel` + seção "Turno" do `ActionsPanel` consomem o store (`playersView`); render reativo de caixa/vez/mão/Bus Tickets/pote/Próx. GO
- ✅ **021** — **Log de eventos** real: `GameState.log` (`LogEntry {who,what}`, bound 50) + `logEvent`; emissões no núcleo (rolar/GO/compra/aluguel/imposto/dívida/falência/saque — só o deck); painel **Histórico** consome `[...game.log].reverse()`
- ✅ **022** — **Modais centrais** dirigidos por resolução: `activeModal(game) → ModalView` (puro, testado) + `ModalLayer` (overlay central, reusa o visual dos popovers); compra/recusa, leilão (propriedade+casas), descarte (mão cheia, privacidade VI), Atalho e escolhas do Speed Die (ônibus/triple). _Acabamento visual a confirmar no `bun run dev`._
- ✅ **022.1** (glue de jogabilidade, fora do SDD) — `DiceArena` central ligado ao motor + `GameDriver` (auto-resolve/finaliza) + HUD enxuto (só decisões) + `DebugLogger` (console) + `LiveTokens` andando casa a casa
- ✅ **023** — **Construção/hipoteca pelo tabuleiro**: predicados puros no motor (`canBuildHouse`/`canSellBuilding`/`canBuildHangar`/`canSellHangar`/`canMortgage`/`canUnmortgage`, comandos delegam) + `deedView(game,pos)` (puro, testado) + ações nos popovers (`DeedActions`) + `BuildingMark`/`MortgageMark` lendo estado real. _Acabamento visual a confirmar no `bun run dev`._
- ✅ **024** — **Negociação (trade) na UI**: `validateTrade` extraído (executeTrade delega) + `tradableProps` + `GameState.pendingTrade` + reducers `proposeTrade`/`acceptTrade`/`rejectTrade` (testados) + `TradeLayer` (compositor 2 colunas + modal recebido, com imunidades §8.4) + botão "Negociar". _Acabamento visual a confirmar no `bun run dev`._
- ✅ **Polimento de fluidez** (glue, fora do SDD): **cor real do dono** na célula comprada (`ClassicSquare` lê `game.titles`); **token = `PlayerFace`** (rosto) de volta no `LiveTokens`; HUD de prisão explicita a 3ª tentativa; **feedback de caixa** (delta flutuante no `PlayerRow`); painel **"Efeitos ativos" real** (`tempEffects`) + **`EffectMark`** pulsante nas casas afetadas (apagão/greve/boicote/imunidade-temp); dado já anima (3D no `DiceArena`)
- ✅ **025** — **Revelação de carta sacada**: `card-reveal` (ResolutionSlice) + `cardRevealResolve` (peek) + `confirmCardReveal` (saca via `cardResolve` intacto); modal central (nome/deck/raridade/descrição + "Continuar"). _Acabamento visual a confirmar no `bun run dev`._
- ❌ **026** — **Leilão de casas em escassez**: **DESCONTINUADA (2026-05-25, [D-022](DECISIONS.md))** — escassez de construção removida (construção ilimitada). `economy/houseAuction.ts`, `HouseAuctionLayer`, botão no `PlayersPanel` e testes apagados; `GameState.houseAuction` removido.
- ✅ **027** — **Painel Trades ao vivo**: `GameState.tradeHistory` (bounded) + `acceptTrade` registra/loga; `tradesView` (puro) + painel real (pendente + histórico); mock removido.
- ✅ **028** — **Transferência de imunidade existente** (§8.4): `Trade += fromImmunityTransfers?`/`toImmunityTransfers?` (posições); `validateTrade` exige `hasImmunity(ofertante, pos)`; `executeTrade` re-atribui o `beneficiaryId` (preserva voltas + `granterId`), antes das concessões novas. Compositor ganha seção "Transferir imunidade" por lado; modal recebido lista 🛡️➡️. _Acabamento visual a confirmar no `bun run dev`._

- ✅ **029** — **Painel "Minhas Cartas" + jogar cartas da mão** (§12.4): fecha o gap mais grave do M2. Seletores puros `handCardsView(game, playerId)` (lista + `playable`/`reason` por timing) e `cardTargets(game, playerId, cardId)` (alvos válidos reusando `reactorFor`/`canAudit`/`ownerOf`); `HandPanel` (cor de raridade, nome, efeito, "Usar" gated + motivo, contador X/3) no `ActionsPanel`; `HandCardLayer` + `useHandCardUI` (seletor de alvo) → `playHandCard`. Mapas de rótulo/cor extraídos p/ `cardMeta.ts` (ModalLayer importa; modais inalterados). Reação (Diplomacia/Bunker) listada mas desabilitada (dispara pelo prompt do HUD). 11 casos em `tests/game/ui/handView.test.ts`. **Zero mudança de motor.** _Acabamento visual a confirmar no `bun run dev`._

- ✅ **030** — **Modais informativos** (§12.2, fecha o §12): "Free Parking coletado" e "Aquisição Hostil sofrida". Evento autônomo `GameState.notice` (padrão `pendingTrade`/`houseAuction`, serializável, **não** bloqueia o turno); hook mínimo no motor — `collectCenter` (007) e `acquire` (016) registram; `dismissNotice` limpa. `NoticeLayer` (overlay + "OK"). 5 casos em `tests/game/economy/notice.test.ts`; 007/016 intactos. _Acabamento visual a confirmar no `bun run dev`._

- ✅ **031** — **Leilão de escassez de terrenos** (D-023 / SRS §7.3): pregão **simultâneo** dos últimos terrenos livres. Evento autônomo `GameState.landAuction` (+ `landAuctionArmed`); `economy/landAuction.ts` — `maybeOpenLandAuction` (gatilho 1≤livres≤3 + ≥2 vivos + trava de episódio), `placeLandBid` (§7.2 + **trava de solvência** `committedCash`), `closeLandAuction` (líder paga banco+escritura; sem lance fica livre). Cronômetro próprio no store (padrão/`deadline` do 003). `LandAuctionLayer` no `App`. 13 casos em `landAuction.test.ts`. _Acabamento visual a confirmar no `bun run dev`._

### Pendente (UI single-player)

- [ ] Acabamento visual de todos os modais/painéis no `bun run dev` (não tenho como ver a tela).
- [ ] Roteamento **per-cliente** das notificações (a "Aquisição Hostil sofrida" é, conceitualmente, da vítima) — depende do M3.

**Resultado:** **M2 fechado.** `bun run dev` = uma partida **local** jogável de ponta a ponta — turno, economia, construção/hipoteca, negociação, **cartas de mão** e os modais do §12 completos. Falta só validação visual; o grande próximo passo é o **M3 (multiplayer/sessão)**.

---

## M3 — Multiplayer, Sala & Sessão (Supabase)

> **Não é opcional.** O SRS §16 descarta hotseat/local: a entrega do v1 é **multiplayer online via sala**. O `bun run dev` de hoje (um cliente) é andaime de M2, não o produto.
>
> **A favor:** o `GameState` já é JSON puro e os reducers são `(state) → state` (princípio VII). Falta só a **camada de transporte/autoridade/persistência** em volta — nenhuma regra de jogo muda.

### Decisões travadas (ADR — 2026-05-24) ✅

- ✅ **[D-019](./DECISIONS.md#d-019--autenticação-anônima-por-link-sem-contas-no-v1) — Autenticação anônima por link**: sem contas no v1; identidade = token de sessão (`localStorage`) + nome/token visual escolhidos no lobby; o link da sala é a credencial; o token viabiliza reconexão (§11.4). E-mail/perfis = v2.
- ✅ **[D-020](./DECISIONS.md#d-020--modelo-de-autoridade--sincronização-host-autoritativo--realtime--snapshot) — Autoridade & sync: host-autoritativo + Realtime + snapshot**: o host roda o reducer puro; clientes enviam **comandos**; host aplica e **difunde o snapshot**; snapshot do `GameState` **persistido** a cada comando (resiliência §11.4). Autoridade única lineariza (sem conflito) e casa com §11.3 (host cai → pausa, sem transferência). Reducer puro pronto p/ migrar a server-autoritativo depois.

### Sequência de features (cada uma é uma fatia SDD)

1. [ ] **Infra Supabase** — projeto + env; schema `rooms`/`games`/`players` (estado = coluna JSON do snapshot); RLS; cliente Realtime. Fundação das demais.
2. [ ] **Transporte de comandos + sync de estado** — o núcleo do M3: enviar comando do cliente → aplicar no lado autoritativo (D-020) → difundir snapshot → **persistir**. O motor não muda; isto é a casca em volta dele.
3. [ ] **Lobby & Sala** (§11.1/§11.2) — criar sala (host + link único); entrar com **nome + token único** (§12.5); lista de jogadores em tempo real (Realtime presence); host **kicka**/**inicia** (≥2); rolagem da ordem inicial.
4. [ ] **Sessão & Resiliência** (§11.3/§11.4, D-016, princípio VII) — desconexão de **qualquer** jogador → **pausa global** + aviso a todos; reconexão pelo mesmo link recarrega do servidor; **reload sem perda**; **host desconectado pausa indefinidamente, sem transferência** (§16); propriedades do desconectado **não** vão ao banco. Status de desconectados no HUD (§12.3).
5. [ ] **Roteamento** — home → criar/entrar → lobby → partida → fim de jogo.

### Regras que estavam "simplificadas" e voltam aqui (precisam de vários jogadores)

6. [ ] **Leilão dos bens do falido-ao-banco** (§9.2) — ao falir **devendo ao banco**, as propriedades (sem construções) vão a **leilão** entre os demais, em vez de voltar grátis. Reusa o motor de leilão (003).

---

## M4 — Polimento & Lançamento

- [ ] Animações (dados rolando, movimento de token)
- [ ] Acessibilidade (foco, leitor de tela, contraste) e responsivo (tablet/celular landscape)
- [ ] Tela de fim de jogo com resumo
- [ ] Sons (opcional v1) · Telemetria mínima (partidas iniciadas/finalizadas/erros)
- [ ] Deploy + CI · Smoke test E2E (uma partida completa)

---

## Fora de escopo (v1) — confirmado em SRS §16

- IA / bots · Modo hotseat · Timer obrigatório de turno · Chat em tempo real
- Espectadores · Histórico de partidas · App mobile nativo
- Múltiplos temas simultâneos · Co-propriedade · Sistema de draft inicial

---

**Documento vivo.** Atualizar ao concluir cada feature/milestone e ao registrar nova decisão em `docs/DECISIONS.md`.
