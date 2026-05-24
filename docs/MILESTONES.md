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

## M1 — Motor de jogo (lógica) ✅ (gaps menores)

Lógica de jogo **pura, serializável e testada** em `src/game/` (Zustand + Vitest). Cada item abaixo é uma feature SDD completa (`spec→plan→tasks→implement`).
**Estado: 214 testes verdes (`bunx vitest run tests/game`). Motor M1 completo (regras + tema + §9.4). M2 (UI) em andamento: dado central + auto-avanço, modais de resolução, Histórico ao vivo, token animado, gestão de propriedade (construção/hipoteca) e negociação (trade) pelo tabuleiro.**

### Feito

- ✅ **001 Tabuleiro & Casas** — estrutura de 48 casas (SRS §2) + render estático do board
- ✅ **002 Fluxo de Turno** — FSM pura: rolar/mover/resolver/finalizar, duplas, prisão, Speed Die; resolução por portas
- ✅ **003 Compra & Aluguel** — compra/recusa, leilão (timer), aluguel escalonado por posse; introduz **caixa** e **títulos**
- ✅ **004 Construção** — casas/hotel, uniformidade, grupo parcial (70%), estoque do banco, leilão de casas
- ✅ **005 Hipoteca** — hipotecar/deshipotecar (metade + 10%), regra de transferência
- ✅ **006 Sistema de Cartas** — 2 decks (Acaso/Tesouro), raridades, mão (limite 3, privada), saque, timing, 14 efeitos autocontidos + framework; **D-018** propagado (Surpresa→Acaso)
- ✅ **007 Balanceamento/Catch-up** — GO Progressivo + Free Parking (pote); imposto/multa de prisão debitam de fato
- ✅ **008 Falência & Fim de jogo** — dívida pendente (pagar/falir), destino dos ativos (§9.2), eliminação, vitória
- ✅ **009 Bus Tickets** — *uso* do ticket (mover pelo lado, §10.7) + espaço Bus Ticket concede +1 (§2.7); contador já existia (006/D-012)
- ✅ **010 Empréstimos** — solicitar na dívida pendente, juros simples por GO, quitar (só principal), máx. 1 ativo/devedor; **destrava a Falência §9.3** (credor do empréstimo herda ativos+passivos)
- ✅ **011 Construção avançada** — 2º hotel (§14, escassez de estoque), Hangar (§13.6, dobra aluguel do aeroporto), Skyscraper (§13.7, grupo completo, aluguel fixo + ×3 no grupo); ladder 0–7
- ✅ **012 Tax Man** (§13.8) — Fiscal do banco move a cada turno (porta em `advanceSeat`) e cobra do dono o aluguel da casa onde para (removido da economia); catch-up discreto. **Fecha as mecânicas de balanceamento.**
- ✅ **013 Negociação — troca** (§8.1–§8.3) — `executeTrade`: trocar propriedades (incl. hipotecadas, taxa de 10%) + caixa entre dois jogadores, a qualquer momento; cartas/Bus Tickets/construções não-negociáveis
- ✅ **014 Imunidade de aluguel** (§8.4 / D-010) — concedida na troca, por N voltas ou permanente; beneficiário não paga (pessoal); expira no GO; visível no HUD. **Negociação completa** (transferência de imunidade existente deferida)
- ✅ **015 Cartas — efeitos temporários** (§10.6) — Apagão (Hangares off), Greve (utilidades $0), Boicote (propriedade sem aluguel), Imunidade Temporária (não-alvo); `GameState.tempEffects` + expiração no GO; respeitado por aluguel e Tax Man
- ✅ **016 Cartas ofensivas com alvo** (§10.6) — Aquisição Hostil (força venda, ×1,5 aeroporto/utilidade), Despejo (demole casa), Auditoria Fiscal (10% do patrimônio ao pote); respeitam Imunidade Temporária
- ✅ **017 Cartas de reação** (§10.6/§12.4) — Diplomacia (cancela ofensiva; atacante perde a carta) e Bunker Fiscal (cancela imposto); interrupção via `resolution`. **Sistema de cartas COMPLETO — 0 cartas no-op.**
- ✅ **018 Tema "Cidades do Mundo"** — valores oficiais centralizados em `src/game/theme.ts` (fonte única, tunável); nomes de casa únicos; ficha em `docs/TEMA.md`.
- ✅ **019 Limpeza na eliminação** (§9.4) — `declareBankruptcy` remove imunidades concedidas/recebidas e `tempEffects` originados pelo eliminado; `Immunity` ganha `granterId`. **M1 (motor) completo.**

### Pendente (engine — gaps menores)
- [ ] **Transferência de imunidade existente** (§8.4 "transferíveis").
- [ ] **Rebalanceamento pós-playtest** (tuning dos knobs em `theme.ts`).

---

## M2 — UI jogável (wiring motor ↔ tela) 🟡 em andamento

O salto para **jogar de verdade**. O **HUD inferior** (`GameHUD`) já consome o store e dirige o turno (rolar/comprar/leilão/dívida/cartas/reação/Bus Ticket/empréstimo). Fatias por feature SDD:

- ✅ **020** — `PlayersPanel` + seção "Turno" do `ActionsPanel` consomem o store (`playersView`); render reativo de caixa/vez/mão/Bus Tickets/pote/Próx. GO
- ✅ **021** — **Log de eventos** real: `GameState.log` (`LogEntry {who,what}`, bound 50) + `logEvent`; emissões no núcleo (rolar/GO/compra/aluguel/imposto/dívida/falência/saque — só o deck); painel **Histórico** consome `[...game.log].reverse()`
- ✅ **022** — **Modais centrais** dirigidos por resolução: `activeModal(game) → ModalView` (puro, testado) + `ModalLayer` (overlay central, reusa o visual dos popovers); compra/recusa, leilão (propriedade+casas), descarte (mão cheia, privacidade VI), Atalho e escolhas do Speed Die (ônibus/triple). _Acabamento visual a confirmar no `bun run dev`._
- ✅ **022.1** (glue de jogabilidade, fora do SDD) — `DiceArena` central ligado ao motor + `GameDriver` (auto-resolve/finaliza) + HUD enxuto (só decisões) + `DebugLogger` (console) + `LiveTokens` andando casa a casa
- ✅ **023** — **Construção/hipoteca pelo tabuleiro**: predicados puros no motor (`canBuildHouse`/`canSellBuilding`/`canBuildHangar`/`canSellHangar`/`canMortgage`/`canUnmortgage`, comandos delegam) + `deedView(game,pos)` (puro, testado) + ações nos popovers (`DeedActions`) + `BuildingMark`/`MortgageMark` lendo estado real. _Acabamento visual a confirmar no `bun run dev`._
- ✅ **024** — **Negociação (trade) na UI**: `validateTrade` extraído (executeTrade delega) + `tradableProps` + `GameState.pendingTrade` + reducers `proposeTrade`/`acceptTrade`/`rejectTrade` (testados) + `TradeLayer` (compositor 2 colunas + modal recebido, com imunidades §8.4) + botão "Negociar". _Acabamento visual a confirmar no `bun run dev`._
- ✅ **Polimento de fluidez** (glue, fora do SDD): **cor real do dono** na célula comprada (`ClassicSquare` lê `game.titles`); **token = `PlayerFace`** (rosto) de volta no `LiveTokens`; HUD de prisão explicita a 3ª tentativa; **feedback de caixa** (delta flutuante no `PlayerRow`); painel **"Efeitos ativos" real** (`tempEffects`) + **`EffectMark`** pulsante nas casas afetadas (apagão/greve/boicote/imunidade-temp); dado já anima (3D no `DiceArena`)
- ✅ **025** — **Revelação de carta sacada**: `card-reveal` (ResolutionSlice) + `cardRevealResolve` (peek) + `confirmCardReveal` (saca via `cardResolve` intacto); modal central (nome/deck/raridade/descrição + "Continuar"). _Acabamento visual a confirmar no `bun run dev`._
- [ ] Painel **Trades** ao vivo (Histórico já é real; resto do log — construção/hipoteca/trade/loan/reação — é adição futura one-liner)
- [ ] Gatilho do leilão de casas por escassez (motor já tem `openHouseAuction`)

**Resultado:** `bun run dev` = uma partida **local** jogável de ponta a ponta (um cliente; multiplayer fica para M3).

---

## M3 — Multiplayer, Sala & Sessão (Supabase)

- [ ] Plan de **Estado/Sync**: snapshot serializável (o motor já é) → canais Supabase, autoridade, resolução de conflito
- [ ] Setup Supabase (projeto, env, migrations) + cliente realtime
- [ ] Autenticação (anônima vs. e-mail — decisão pendente)
- [ ] **Lobby & Sala**: criar (host + link), entrar/escolher nome e token, lista em tempo real, host kicka/inicia, rolagem de ordem inicial
- [ ] **Sessão & Resiliência** (D-016): detecção de desconexão → pausa global, reconexão pelo mesmo link, reload sem perda, host desconectado sem transferência
- [ ] Roteamento: home → criar/entrar → lobby → partida → fim

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
