# Banco Master — PRD (Product Requirements Document)

> **O que este doc é:** a visão de **produto** amarrando objetivo → épicos → specs → status, e o
> **mapa do que falta para o v1.0**. Não substitui o [`SRS.md`](./SRS.md) (verdade de regras) nem o
> [`MILESTONES.md`](./MILESTONES.md) (roadmap macro) — é a camada de rastreabilidade entre eles.
> Última atualização: 2026-07-25 · 436 testes verdes · engine e UI single-player fechados; **fundação multiplayer entregue (spec 037)** — falta a experiência online (perspectiva local, identidade real, roteamento).

---

## 1. Objetivo do produto

Clone web **multiplayer online** do Richup.io/Monopoly, até 8 jogadores humanos (sem IA/bots), tema
"Cidades do Mundo", base extensível. **A entrega do v1.0 é uma partida multiplayer via sala** — o
`bun run dev` de hoje (um cliente, ponta a ponta jogável) é andaime, não o produto (SRS §16).

## 2. Personas & modo

- **Anfitrião (host):** cria a sala, compartilha o link, inicia a partida (≥2 jogadores). No modelo
  travado (D-020) é a autoridade de estado.
- **Convidado:** entra pelo link com nome + token visual; sem conta (D-019).
- **Modo único:** online por sala. Hotseat/local **fora de escopo** (SRS §16).

## 3. Critérios de "finalizado" (Definition of Done do v1.0)

1. 2–8 humanos jogam uma partida completa **online**, cada um no seu dispositivo.
2. Desconexão/reload **não pune** e não perde a partida (princípio VII, §11.4).
3. Todas as regras do SRS que exigem múltiplos jogadores estão ativas (leilão do falido §9.2).
4. Lobby com nomes reais (nunca `p1..pN`), tela de fim de jogo, deploy + CI verdes.

---

## 4. Mapa Épico → Specs → Status

Legenda: ✅ entregue · ❌ descontinuada · ⏳ pendente (sem spec ainda).

### E1 — Tabuleiro & Tema
| Spec | O que entrega | Status |
|---|---|---|
| 001 | 48 casas (SRS §2) + render estático | ✅ |
| 018 | Tema "Cidades do Mundo"; `theme.ts` fonte única | ✅ |
| 032 | Rebalanceamento (custo por tier, aluguel por multiplicador, board) — D-024 | ✅ |
| 033 | 10º grupo super-luxo Emirados (armadilha de prestígio) — D-025 | ✅ |

### E2 — Fluxo de turno
| 002 | FSM pura: rolar/mover/resolver/finalizar, duplas, prisão, Speed Die (suspenso D-003) | ✅ |

### E3 — Economia base (compra / aluguel / hipoteca)
| 003 | Compra/recusa, leilão comum, aluguel por posse; caixa + títulos | ✅ |
| 005 | Hipoteca/deshipoteca (metade + 10%), transferência | ✅ |

### E4 — Construção
| 004 | Casas/hotel, uniformidade, grupo parcial | ✅ |
| 011 | 2º hotel, Hangar, Skyscraper (ladder 0–7) | ✅ |
| 034 | Construção com país PARCIAL (1+ cidade, aluguel escala 50→100%) + Bus Ticket no fim do turno — D-026/D-027 | ✅ |

### E5 — Sistema de cartas
| 006 | 2 decks, raridades, mão (limite 3, privada), 14 efeitos + framework | ✅ |
| 015 | Efeitos temporários (Apagão/Greve/Boicote/Imunidade temp) | ✅ |
| 016 | Ofensivas com alvo (Aquisição Hostil/Despejo/Auditoria) | ✅ |
| 017 | Reação (Diplomacia/Bunker) — **0 cartas no-op** | ✅ |
| 025 | Revelação da carta sacada (modal) | ✅ |
| 029 | Painel "Minhas Cartas" + jogar da mão (§12.4) | ✅ |

### E6 — Bus Tickets
| 009 | Uso do ticket (§10.7) + espaço concede +1; **negociáveis em trocas** (D-028) | ✅ |

### E7 — Empréstimos
| 010 | Solicitar na dívida, juros por GO, quitar; destrava Falência §9.3 | ✅ |

### E8 — Negociação / Trade
| 013 | `executeTrade`: propriedades + caixa entre dois jogadores | ✅ |
| 014 | Imunidade de aluguel (§8.4/D-010) | ✅ |
| 024 | Trade na UI (compositor + modal recebido) | ✅ |
| 027 | Painel Trades ao vivo (histórico) | ✅ |
| 028 | Transferência de imunidade existente | ✅ |

### E9 — Balanceamento / Catch-up
| 007 | GO fixo $200/$400 (D-007) + Free Parking; imposto/multa debitam | ✅ |
| 012 | Tax Man (§13.8) — fecha as mecânicas de balanceamento | ✅ |

### E10 — Falência & Fim de jogo
| 008 | Dívida pendente, destino de ativos (§9.2 parcial), eliminação, vitória | ✅ |
| 019 | Limpeza na eliminação (§9.4) | ✅ |

### E11 — Leilões de escassez
| 026 | Leilão de casas em escassez | ❌ descontinuada (D-022, construção ilimitada) |
| 031 | Pregão de escassez de terrenos (D-023/§7.3) | ✅ |

### E12 — UI jogável (single-client)
| 020 | Painéis ao vivo (jogadores/turno) | ✅ |
| 021 | Log de eventos real | ✅ |
| 022 | Modais centrais dirigidos por resolução | ✅ |
| 023 | Construção/hipoteca pelo tabuleiro | ✅ |
| 030 | Modais informativos (Free Parking, Aquisição Hostil) | ✅ |

### E13 — Áudio
| 035 | ~40 cues, 3 canais, unlock de autoplay, SoundBoard (`?sons`) | ✅ |

### E14 — QA / Simulação
| 036 | Fuzzing seedado + invariantes + conservação de dinheiro + smoke E2E | ✅ |

### E15 — Multiplayer, Sala & Sessão (Supabase) — **FECHADO**

> O plano original fatiava em 037 infra / 038 transporte / 039 lobby / 040 sessão. A **spec 037
> absorveu as quatro**: transporte de comandos, sync host-autoritativo, resiliência de sessão e
> lobby mínimo no browser saíram juntos porque compartilham a mesma porta `Transport`. O que
> sobra do E15 é a **experiência** online (038) e a regra que só existe com N jogadores (039).

| Spec | O que entrega | Status |
|---|---|---|
| 037 | Fundação host-autoritativa: `applyCommand` puro, difusão por comando com não-determinismo gravado/replicado, snapshot upsert, pausa por presença, reconexão/reload, anti-spoof, lobby mínimo (nome+cor+link+iniciar), migration + adapter Supabase | ✅ (infra viva pendente: aplicar a migration) |
| 038 | Partida online de verdade: perspectiva de jogador local (mão privada de fato), identidade real (nomes/cores/peças no lugar de `p1..pN`), status de conexão/pausa visível, roteamento home → sala → partida → fim, kick no lobby, ordem inicial sorteada | ✅ |
| 039 | Leilão do **espólio** do falido-ao-banco (§9.2 / D-031): pregão simultâneo reusando a D-023, com discriminador de origem e injeção de lotes em pregão aberto | ✅ |

### E16 — Polimento & Lançamento (M4) — **LANÇADO EM PRODUÇÃO** (2026-07-27)

| Spec | O que entrega | Status |
|---|---|---|
| 044 | Classificação e resumo no fim de jogo (D-038, 4 campos novos no estado, `matchSummary` derivada); WCAG 2.2 AA no caminho de jogo com gate `axe` no CI (D-039 — trap de foco e política de Esc no primitivo de modal, região viva sobre o log tipado, teclado no tabuleiro); paisagem em tablet e celular com aviso de girar em retrato; vocabulário único de movimento com freio de `prefers-reduced-motion`; telemetria mínima anônima (D-040 — porta com adaptador nulo, Supabase + Sentry, id de sala nunca em claro); publicação na Vercel promovida só com gate verde (D-041); smoke E2E de partida completa sobre o build | ✅ |

> **O que falta é operação, não código** (`docs/RUNBOOK.md`): aplicar as quatro migrations em produção, ligar o projeto na Vercel com as variáveis, promover o primeiro deploy e ensaiar o retorno uma vez.

---

## 5. O que falta para finalizar (v1.0)

Duas frentes independentes. A **de produto** (E15/E16) é o caminho crítico; a **técnica** (backlog da
auditoria) blinda o que já existe e várias partes são pré-requisito direto do multiplayer.

### 5.1 Caminho crítico de produto — o bloqueador é o M3

O engine e a UI single-player estão fechados, e a **fundação multiplayer saiu** (037). O que separa
"dois browsers conectados" de "v1.0" é a **experiência** online (038) e o polimento de lançamento
(E16). Ordem vigente:

1. **037 Fundação multiplayer** — ✅ entregue. A migration aplicada e verificada em produção
   (`RUNBOOK.md` §1); SC-002/SC-006 medidos no teste de fumaça em produção (T064, 2026-07-27).
2. **038 Partida online de verdade** — ✅ entregue (2026-07-25). Roteiro manual em dois browsers
   rodado no teste de fumaça de produção; o DoD #4 do §3 (lobby com nomes reais) está cumprido.
3. **039 Leilão do espólio do falido-ao-banco** (§9.2) — ✅ entregue (2026-07-25). **O SRS não tem mais lacuna de regra**: era a última.
4. **044 Polimento & Lançamento** — ✅ entregue e **lançado em produção** (2026-07-27): as quatro
   migrations (037, 041, 043 e a de telemetria da 044) aplicadas, projeto ligado na Vercel, gate
   verde promovendo, smoke test e ensaio de rollback do [`RUNBOOK.md`](RUNBOOK.md) §3/§4 rodados.
   **v1.0 está no ar.**

> **Decisão travada antes de specificar 037 — resolvida:** a autoridade de estado (item 17 da
> auditoria / `store.ts:262`) foi fechada pela 037: todo comando carrega o `playerId` do remetente e
> o host o confere contra o assento da conexão, descartando spoof (provado em `tests/net/antispoof.test.ts`).
> A ressalva que existia aqui — no transporte Supabase o remetente era auto-declarado no payload, então
> a paridade dependia só da **lógica** do host — foi fechada pela **spec 043** ([D-042](adr/D-042-identidade-de-transporte-atestada-pelo-servidor.md)/[D-036](adr/D-036-acesso-a-sala-autorizado-no-servidor.md)/[D-037](adr/D-037-estado-por-perspectiva-a-mao-nao-trafega.md)/[D-043](adr/D-043-o-codigo-de-reentrada-e-imutavel-e-a-autoridade-o-le.md)): a identidade passou a ser
> o `uid` da sessão anônima, atestado pelo servidor, e o **remetente vem do endereço do tópico**, não do
> conteúdo. Não foi preciso Edge Function — a política de canal do Realtime compara o sufixo do tópico
> com `auth.uid()`, e é isso que torna o remetente inforjável. A conferência do host continua onde
> estava (`tests/net/antispoof.test.ts`), agora apoiada em dado que o remetente não escolhe.

### 5.1.1 Arquitetura frontend-first (D-020, refinada em 2026-07-24)

**Sem backend próprio no v1** — só cliente + Supabase como BaaS (Realtime + Postgres + auth anônima).
O host roda o reducer puro; o "backend real" (server-autoritativo via Edge Function rodando o mesmo
`src/game`) fica pro futuro e é **troca de transporte, não reescrita** (reducer puro é o ativo que barateia isso).

- **Difusão por comando, não por snapshot:** host difunde o **comando aceito** (bytes); cada cliente
  aplica localmente (reducer determinístico → convergência). Snapshot completo só ao **entrar** e **reconectar**.
- **Custo — free tier cobre o MVP com folga:** Postgres 500 MB (milhares de snapshots de poucos KB),
  ~200 conexões Realtime (~25 partidas de 8p simultâneas), auth anônima não consome MAU (credencial = link).
  Gotcha: free **pausa após ~7 dias** de inatividade. **Pro ($25/mês)** só com tração real — custo escala
  com jogadores, não com dev.
- **Identidade nos comandos:** cada comando carrega o `playerId` do remetente p/ o host rejeitar spoof
  (fecha `store.ts:262` / item 17).

### 5.2 Backlog técnico (auditoria 2026-07-23 — revalidada contra o código em 2026-07-27)

Já resolvidos: 1, 2, 7, 14 (3 bugs de engine + SRS v1.3). Dos itens que restavam, **todos os de
prioridade Alta/Média foram fechados por specs posteriores** — revalidado item a item contra o
código atual, não só contra o título da linha:

| Item | Status | Onde fechou |
|---|---|---|
| CI GitHub Actions + zerar 36 erros de lint | ✅ | `.github/workflows/ci.yml`; `bun run lint`/`typecheck` limpos hoje |
| Log tipado `LogEntry {kind,who,amount,what}` | ✅ | spec **040** |
| Persistência do `GameState` em localStorage + `ErrorBoundary` | ✅ (superado) | `src/app/RootErrorBoundary.tsx` (spec 042); a persistência virou o **snapshot no Supabase** (037/041), que cobre F5 de forma mais forte do que localStorage cobriria |
| Leilão comum multi-licitante + botão "passar" (`passBid` órfão) | ✅ | `passBid` está cabeado em `src/game/commands.ts` (`case 'pass-bid'`) — não é mais órfão |
| Dead code de `boards/shared.tsx` (`HOUSE_COST` divergente, mocks, componentes órfãos) | ✅ | não há mais `HOUSE_COST` no arquivo; nenhum mock real restante (grep revalidado) |
| Sim: registrar vencedor/curva de patrimônio | ✅ | `tests/sim/engine/report.ts` — `winnersBySeat` + `wealthCurve`/`wealthCurveWithEstate` |
| Acessibilidade base | ✅ | gate WCAG 2.2 AA no CI (spec 044/D-039) — foi além de "base" |
| Extrair `src/game/setup.ts` puro | ✅ | arquivo existe |
| Fatiar god file `shared.tsx` + quebrar ciclo `shared.tsx ↔ game/ui` | ⏳ **ainda aberto** | `src/boards/shared.tsx` está em **2.210 linhas** (caiu de 3.261, mas segue god file) e o ciclo continua: `GameHUD.tsx`, `ModalLayer.tsx`, `TradeLayer.tsx`, `LiveTokens.tsx`, `motion.ts`, `primitives.tsx`, `a11y/LiveRegion.tsx` e `panels/playersView.ts` importam de `boards/shared`, que por sua vez importa de vários desses mesmos módulos em `game/ui/*` |

**Único item real de dívida técnica que sobrou da auditoria de julho**: fatiar `boards/shared.tsx`
e quebrar o ciclo de import com `game/ui`. Tamanho G — é reestruturação de módulo, não fixup.

---

## 6. Fora de escopo (v1.0) — SRS §16

IA/bots · hotseat · timer obrigatório de turno · chat em tempo real · espectadores · histórico de
partidas · app mobile nativo · múltiplos temas simultâneos · co-propriedade · draft inicial.

## 7. Métricas de sucesso (v1.0)

- Uma partida 2–8p completa online sem perda de estado por desconexão/reload.
- 0 bugs de corrupção de estado conhecidos no engine (CI verde travando regressão).
- Economia converge (partida termina por falência antes do cap) — já validado no sim; revalidar com
  agente menos caótico + métricas de vencedor.
