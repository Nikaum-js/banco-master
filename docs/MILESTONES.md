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

## M1 — Motor de jogo (lógica) 🟡 em andamento

Lógica de jogo **pura, serializável e testada** em `src/game/` (Zustand + Vitest). Cada item abaixo é uma feature SDD completa (`spec→plan→tasks→implement`).
**Estado: ~68 testes verdes (`npx vitest run tests/game`). ⚠️ Ainda NÃO ligado à UI — não é jogável no navegador (ver M2).**

### Feito

- ✅ **001 Tabuleiro & Casas** — estrutura de 48 casas (SRS §2) + render estático do board
- ✅ **002 Fluxo de Turno** — FSM pura: rolar/mover/resolver/finalizar, duplas, prisão, Speed Die; resolução por portas
- ✅ **003 Compra & Aluguel** — compra/recusa, leilão (timer), aluguel escalonado por posse; introduz **caixa** e **títulos**
- ✅ **004 Construção** — casas/hotel, uniformidade, grupo parcial (70%), estoque do banco, leilão de casas
- ✅ **005 Hipoteca** — hipotecar/deshipotecar (metade + 10%), regra de transferência
- ✅ **006 Sistema de Cartas** — 2 decks (Acaso/Tesouro), raridades, mão (limite 3, privada), saque, timing, 14 efeitos autocontidos + framework; **D-018** propagado (Surpresa→Acaso)

### Pendente (engine — specs futuras)

- [ ] **Bus Tickets** — *uso* do ticket (mover pelo lado do tabuleiro); o contador já existe (006/D-012)
- [ ] **Negociação** — proposta, contraproposta, imunidades (D-010)
- [ ] **Empréstimos entre jogadores** (D-009) — solicitar, juros por GO, quitar
- [ ] **Falência & Fim de jogo** — insolvência (hoje só sinalizada por porta `onInsolvency`), redistribuição de ativos, eliminação, vitória
- [ ] **Mecânicas de Balanceamento** — Speed Die já no motor; faltam **GO Progressivo**, **Free Parking** (pote), **Tax Man**, **Hangar**, **Skyscraper**, **2º hotel** (hoje portas/stub: `onPassGo`/`onPayToCenter`/`onCollectCenter`)
- [ ] **Subsistema de Cartas deferido** — ofensivas com alvo (Aquisição Hostil, Despejo, Auditoria), **reação** (Diplomacia, Bunker Fiscal) e **efeitos temporários de N voltas** (Boicote, Imunidade, Apagão, Greve). Hoje são *no-op seguro* no catálogo
- [ ] **Tema "Cidades do Mundo"** — preços, aluguéis e custos de construção **finais** (hoje escada provisória $60–$400 + multiplicadores provisórios)

---

## M2 — UI jogável (wiring motor ↔ tela) 🎯 PRÓXIMO

O salto que falta para **jogar de verdade**: hoje o motor (M1) e o board (001) existem mas **não estão conectados** (nenhum componente consome o `useGameStore`).

- [ ] Consumir o store (`useGameStore`) na UI; render reativo do estado da partida
- [ ] Controles do turno: **Rolar Dados**, **Finalizar Turno**, decisão de prisão, escolhas do Speed Die (Ônibus/Triple)
- [ ] Movimento do **token** na tela (animação) a partir de `player.pos`
- [ ] Modais funcionais: compra/recusa, leilão, carta sacada, descarte (4ª carta), construir/vender, hipoteca
- [ ] Painéis: **caixa**, **mão** (própria, privada) + contador das mãos dos outros, estoque do banco, pote do centro
- [ ] HUD do mockup vira **funcional** (jogadores, dados, log de eventos)

**Resultado:** `npm run dev` = uma partida **local** jogável de ponta a ponta (um cliente; multiplayer fica para M3).

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
