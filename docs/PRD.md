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

### E16 — Polimento & Lançamento (M4) — **NÃO COMEÇOU**
| ⏳ | Tela de fim de jogo com resumo; acessibilidade/responsivo; telemetria mínima; deploy + CI | ⏳ |

---

## 5. O que falta para finalizar (v1.0)

Duas frentes independentes. A **de produto** (E15/E16) é o caminho crítico; a **técnica** (backlog da
auditoria) blinda o que já existe e várias partes são pré-requisito direto do multiplayer.

### 5.1 Caminho crítico de produto — o bloqueador é o M3

O engine e a UI single-player estão fechados, e a **fundação multiplayer saiu** (037). O que separa
"dois browsers conectados" de "v1.0" é a **experiência** online (038) e o polimento de lançamento
(E16). Ordem vigente:

1. **037 Fundação multiplayer** — ✅ entregue (falta aplicar a migration no projeto Supabase e
   medir SC-002/SC-006 numa partida real).
2. **038 Partida online de verdade** — ✅ entregue (2026-07-25). Falta só o roteiro manual em
   dois browsers; o DoD #4 do §3 (lobby com nomes reais) está cumprido.
3. **039 Leilão do espólio do falido-ao-banco** (§9.2) — ✅ entregue (2026-07-25). **O SRS não tem mais lacuna de regra**: era a última.
4. **M4:** tela de fim de jogo, acessibilidade, telemetria, deploy + CI.

> **Decisão travada antes de specificar 037 — resolvida:** a autoridade de estado (item 17 da
> auditoria / `store.ts:262`) foi fechada pela 037: todo comando carrega o `playerId` do remetente e
> o host o confere contra o assento da conexão, descartando spoof (provado em `tests/net/antispoof.test.ts`).
> Ressalva vigente: no transporte Supabase o token ainda é auto-declarado no broadcast — a **lógica**
> do host rejeita spoof, mas a identidade de transporte pede endurecimento (Edge Function/segredo de
> sessão) para paridade plena.

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

### 5.2 Backlog técnico (auditoria 2026-07-23, itens vigentes)

Já resolvidos: 1, 2, 7, 14 (3 bugs de engine + SRS v1.3). Restantes, por alavancagem:

| Prio | Item | Tam. | Por quê agora |
|---|---|---|---|
| Alta | **CI GitHub Actions + zerar 36 erros de lint** (inclui `useBusTicket`→`spendBusTicket`; `bun update @babel/core`) | P/M | Sem CI, regressões voltam; blinda o ativo mais valioso (o motor) |
| Alta | **Log tipado** `LogEntry {kind,who,amount,what}` | M | Maior alavanca estrutural: destrava explicação de aluguel (D2), som robusto, cor, i18n |
| Média | **Persistência do `GameState` em localStorage + ErrorBoundary** | M | F5/exceção = partida perdida hoje; estado já é serializável |
| Média | **Leilão comum multi-licitante + botão "passar"** (`passBid` órfão) | M | Mecânica central inoperante no hotseat; padrão já existe no pregão |
| — | ~~Lobby mínimo com nomes~~ | — | Coberto: lobby entregue na 037; nomes reais na UI da partida são escopo da **038** |
| Média | **Deletar dead code de `boards/shared.tsx`** (`HOUSE_COST` diverge do tema!, mocks, componentes órfãos) | P | Armadilha de importar constante errada |
| Média | **Sim: registrar vencedor/curva de patrimônio** | M | Pré-requisito p/ validar ROI da construção parcial (D-026) |
| Baixa | Extrair `src/game/setup.ts` puro (composição definida 2×); fatiar god file `shared.tsx` (3.261 linhas) + quebrar ciclo `shared.tsx ↔ game/ui`; acessibilidade base | P–G | Dívida de arquitetura da casca |

---

## 6. Fora de escopo (v1.0) — SRS §16

IA/bots · hotseat · timer obrigatório de turno · chat em tempo real · espectadores · histórico de
partidas · app mobile nativo · múltiplos temas simultâneos · co-propriedade · draft inicial.

## 7. Métricas de sucesso (v1.0)

- Uma partida 2–8p completa online sem perda de estado por desconexão/reload.
- 0 bugs de corrupção de estado conhecidos no engine (CI verde travando regressão).
- Economia converge (partida termina por falência antes do cap) — já validado no sim; revalidar com
  agente menos caótico + métricas de vencedor.
