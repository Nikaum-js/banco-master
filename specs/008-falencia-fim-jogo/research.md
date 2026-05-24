# Research — Falência & Fim de jogo (Fase 0)

Decisões técnicas. Fecha o ciclo econômico.

---

## D1 — Dívida como `ResolutionSlice` (bloqueia o turno)

- **Decisão:** insolvência num pagamento obrigatório abre `resolution = { kind:'debt', amount, creditorId }`; o turno fica pendente (não finaliza) até `payDebt` ou `declareBankruptcy`.
- **Rationale:** reusa o gating de resolução pendente (compra/leilão); o turno já não finaliza com resolução aberta.
- **Alternativas:** campo `pendingDebt` separado — rejeitada: duplicaria o mecanismo de bloqueio.

## D2 — Fluxo manual (clarificação)

- **Decisão:** o jogador em dívida usa os comandos **existentes** (`sellBuilding` 004 / `mortgageProperty` 005) para levantar caixa; `payDebt` paga quando o caixa cobre; senão `declareBankruptcy`. O sistema **não** auto-liquida.
- **Rationale:** clarificação aprovada (mais fiel; o jogador escolhe o que vender). `sellBuilding`/`mortgageProperty` já operam no jogador ativo, sem checar `turn.state` — funcionam com a dívida aberta.

## D3 — `liquidationValue`

- **Decisão:** `liquidationValue(state, id) = cash + Σ(construções a metade do custo) + Σ(hipoteca = preço/2 das propriedades não-hipotecadas do jogador)`. `isBankrupt(state, id, debt) = liquidationValue < debt`.
- **Rationale:** define quando o jogador é *de fato* falido (nem liquidando cobre) vs só precisa liquidar. Usa as mesmas metades de 004/005.

## D4 — Leilão dos bens (dívida ao banco) simplificado

- **Decisão:** na falência **devendo ao banco**, as propriedades voltam ao banco (**`ownerId = null`**, livres) e as construções ao estoque. O **leilão** de cada uma (§9.2) é a regra-alvo, mas fica como **refinamento** (o leilão-em-cascata reusaria o 003).
- **Rationale:** entrega o destino correto (sai do falido, volta ao banco) sem o fluxo interativo de N leilões; documentado.
- **Alternativas:** disparar N leilões agora — rejeitada: custo/escopo desproporcional ao valor.

## D5 — Empréstimo ativo (§9.3) e imunidades (§9.4) deferidos

- **Decisão:** §9.3 (credor herda ativos+passivos) depende de Empréstimos (§15) — fora. Cancelamento de imunidades = **no-op** (cartas de Imunidade são subsistema deferido do 006).
- **Rationale:** fronteira de spec; sem Empréstimos/Imunidade implementados, não há o que herdar/cancelar.

## D6 — Fim de jogo

- **Decisão:** `checkEndGame(state)` — se **1** jogador não-eliminado resta, `phase = 'ended'` e ele é o vencedor. Chamado após cada `declareBankruptcy`.
- **Rationale:** §9.5. Determinístico.

Nenhum `NEEDS CLARIFICATION` pendente (gatilho resolvido no clarify).
