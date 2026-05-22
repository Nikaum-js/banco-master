# Banco Master — Milestones

> Roadmap macro até a v1.0. Lista **o que** falta, não **como** fazer.
> Cada milestone se desdobra em uma ou mais specs do Spec Kit antes de virar código.
> Ordem é sugestão; algumas frentes podem rodar em paralelo.

---

## M0 — Discovery & Mockup ✅ (atual)

- ✅ Constitution (princípios I–VII) e SRS v1.2 consolidados
- ✅ ADRs aceitas e rejeitadas registradas em DECISIONS.md
- ✅ Catálogo de cartas rascunhado em CARTAS.md
- ✅ Spec Kit instalado e configurado
- ✅ Design System "Café Coado" (tokens, tipografia, paleta de grupos)
- ✅ Mockup visual do tabuleiro Clássico (sem lógica — dados estáticos)
- ✅ HUD mockado: jogadores, dados, Speed Die, Pote de Férias, log, efeitos ativos

---

## M1 — Specs de Discovery

Transformar o SRS em specs operacionais, uma por feature. Antes de qualquer código.

- [ ] Spec: **Tabuleiro & Casas** (40 casas, layout, semântica de cada tipo)
- [ ] Spec: **Fluxo de Turno** (rolar, mover, resolver, finalizar, duplas)
- [ ] Spec: **Compra & Aluguel** (modal, leilão, escalonamento por grupo)
- [ ] Spec: **Construção** (casas, hotéis, uniformidade, grupo parcial, escassez)
- [ ] Spec: **Hipoteca**
- [ ] Spec: **Sistema de Cartas** (Surpresa + Tesouro, raridades, mão, timing)
- [ ] Spec: **Bus Tickets**
- [ ] Spec: **Negociação** (proposta, imunidades, contraproposta)
- [ ] Spec: **Empréstimos entre jogadores**
- [ ] Spec: **Falência & Fim de jogo**
- [ ] Spec: **Lobby & Sala** (criar, entrar, host, kick, ordem inicial)
- [ ] Spec: **Sessão & Resiliência** (desconexão, pausa, reconexão, persistência)
- [ ] Spec: **Mecânicas de balanceamento** (Speed Die, GO Progressivo, Free Parking, Tax Man, Hangar, Skyscraper)
- [ ] Spec: **Tema "Estados do Brasil"** (extração de preços/aluguéis finais)

---

## M2 — Planos técnicos

Cada spec aprovada vira um `plan.md` com stack, schema, eventos de sincronização.

- [ ] Plan de **Estado da Partida** (formato, persistência, snapshots)
- [ ] Plan de **Realtime** (canais Supabase, autoridade do servidor, conflict resolution)
- [ ] Plan de **Autenticação** (anônima vs. e-mail — decisão pendente)
- [ ] Plan de **Modelo de dados** (sala, partida, jogador, propriedade, evento, log)

---

## M3 — Skeleton funcional

Esqueleto técnico antes de qualquer regra de jogo.

- [ ] Setup Supabase (projeto, env, migrations base)
- [ ] Cliente realtime conectado
- [ ] Roteamento: home → criar sala → sala/lobby → partida → fim
- [ ] Componentes de UI base extraídos do mockup
- [ ] Sistema de modais centralizado

---

## M4 — Sala & Lobby

- [ ] Criar sala (host recebe link)
- [ ] Entrar via link, escolher nome e token
- [ ] Lista de jogadores conectados em tempo real
- [ ] Host kicka, host inicia (mínimo 2 jogadores)
- [ ] Rolagem de ordem inicial

---

## M5 — Turno básico jogável

Partida minimamente jogável, sem features avançadas.

- [ ] Rolar 2 dados, mover token, animação
- [ ] Resolver casa: GO, propriedade livre, propriedade com dono, imposto, prisão, vá pra prisão
- [ ] Modal de compra
- [ ] Aluguel cobrado entre jogadores
- [ ] Duplas e regra das 3 duplas → prisão
- [ ] Saída da prisão (multa / dupla / 3ª tentativa)
- [ ] Finalizar turno → passa pro próximo
- [ ] Persistência do estado da partida

---

## M6 — Propriedades, construção e hipoteca

- [ ] Painel "Minhas propriedades"
- [ ] Construir casas/hotel (uniformidade, custo, estoque)
- [ ] Vender construções
- [ ] Hipotecar / deshipotecar
- [ ] Aluguel escalonado por grupo (1 de N, parcial, completo, com construções)
- [ ] Grupo parcial 70% (D-004)
- [ ] Segundo hotel (D-008)
- [ ] Skyscraper (SRS §13.7)
- [ ] Leilão de casas em escassez

---

## M7 — Sistema de cartas

- [ ] Decks Surpresa e Tesouro (16 cartas cada)
- [ ] Sacar carta ao parar na casa
- [ ] Cartas de efeito imediato (volta ao fundo)
- [ ] Mão privada com limite de 3 (D-011)
- [ ] Bus Tickets como contador separado (D-012)
- [ ] Catálogo de efeitos (todas as 32 cartas + Bus Ticket)
- [ ] Cartas ofensivas: Aquisição Hostil, Despejo, Auditoria Fiscal, Boicote
- [ ] Cartas de reação: Diplomacia, Bunker Fiscal (prompt em janela de até 10s)
- [ ] Descarte forçado ao exceder mão (4ª carta)

---

## M8 — Mecânicas de balanceamento

- [ ] Speed Die ativado após 1ª volta (D-003)
- [ ] Faces 1/2/3 + Mr. Banco Master + Ônibus + Triples
- [ ] GO Progressivo $100→$400 (D-007, catch-up discreto)
- [ ] Free Parking com prêmio acumulado (D-006)
- [ ] Tax Man (SRS §13.8)
- [ ] Hangar em aeroportos (SRS §13.6)

---

## M9 — Negociação, leilão, empréstimos

- [ ] Modal de leilão em tempo real
- [ ] Modal de negociação (propor, contrapropor, aceitar/recusar)
- [ ] Imunidade de aluguel negociável (D-010)
- [ ] Empréstimos entre jogadores (D-009): solicitar, aceitar, juros por GO, quitar
- [ ] Falência (com e sem empréstimo ativo)
- [ ] Eliminação do jogador (imunidades canceladas)

---

## M10 — Resiliência de sessão

- [ ] Detecção de desconexão
- [ ] Pausa global da partida (D-016)
- [ ] Reconexão pelo mesmo link
- [ ] Reload sem perda de estado
- [ ] Tratamento de host desconectado (sem transferência)

---

## M11 — Polimento e lançamento

- [ ] Animação de movimento de tokens
- [ ] Animação de dados rolando
- [ ] Sons (opcional v1)
- [ ] Acessibilidade (foco, leitor de tela, contraste)
- [ ] Responsivo mobile (tablet/celular em landscape)
- [ ] Tela de fim de jogo com resumo
- [ ] Telemetria mínima (partidas iniciadas, finalizadas, erros)
- [ ] Deploy + CI
- [ ] Smoke test E2E (uma partida completa de ponta a ponta)

---

## Fora de escopo (v1) — confirmado em SRS §16

- IA / bots
- Modo hotseat
- Timer obrigatório de turno
- Chat em tempo real
- Espectadores
- Histórico de partidas
- App mobile nativo
- Múltiplos temas simultâneos
- Co-propriedade
- Sistema de draft inicial

---

**Documento vivo.** Atualizar ao concluir cada milestone e ao registrar nova decisão em `docs/DECISIONS.md`.
