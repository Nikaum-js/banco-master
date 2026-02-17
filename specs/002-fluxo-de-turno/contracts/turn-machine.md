# Contract — Máquina de Turno (Fase 1)

Contrato da FSM do turno: **estados**, **eventos/comandos**, **transições com guardas** e as **portas** para specs irmãs. É o "interface" que esta feature expõe ao resto do jogo. Linguagem-agnóstico; tipos em TS para concretude.

---

## 1. Comandos (API pública do turn slice)

O único ator que pode emitir comandos do turno é o **jogador ativo** (FR-001), exceto reações/recebimento de aluguel de não-ativos (delegados a outras specs).

| Comando | Pré-condição (guarda) | Efeito |
|---|---|---|
| `rollDice()` | `state ∈ {aguardando-rolagem}` e não `paused` | gera `Roll`; aplica movimento; → `casa-a-resolver` (ou desvio à prisão) |
| `jailDecision(d)` | `state = prisao-decisao` | `d ∈ {pay, card, try}`; resolve a saída (FR-016/17/18) |
| `chooseBusMove(opt)` | `lastRoll.special = 'onibus'` | `opt ∈ {die0, die1, sum}`; fixa `move` |
| `chooseTripleDest(pos)` | `lastRoll.special = 'triple'` | define destino; encerra movimento (sem re-roll) |
| `resolvePending()` | `state = casa-a-resolver` | dispara dispatch de resolução (§3); → `aguardando-finalizacao` quando `done` |
| `finalizeTurn()` | `state = aguardando-finalizacao` e `!pendingResolve` | se `mayRollAgain` → novo ciclo; senão → `encerrado` → próximo jogador |

> Comandos inválidos para o estado atual são **no-op** (rejeitados), nunca lançam o turno a estado ilegal.

---

## 2. Transições (FSM)

```
[início do turno]
   ├─ jogador preso?  → prisao-decisao
   └─ senão           → aguardando-rolagem

aguardando-rolagem --rollDice--> (movimento)
   ├─ 3ª dupla consecutiva  → [vai à prisão, move descartado] → encerrado
   ├─ casa = corner-gotojail/carta-prisão → [à prisão, sem GO] → encerrado
   └─ senão                 → casa-a-resolver

prisao-decisao --jailDecision-->
   ├─ pay  ($50→centro)     → aguardando-rolagem (rola normal; sair c/ dupla NÃO re-rola)
   ├─ card (Saia da Prisão) → aguardando-rolagem
   └─ try  → dupla? sai e move (sem re-roll, FR-019) ; senão attempts++ →
            ├─ attempts < 3 → encerrado (segue preso)
            └─ attempts = 3 → paga $50 + move (FR-018) → casa-a-resolver

casa-a-resolver --resolvePending--> [dispatch §3]
   └─ todas pendências resolvidas → aguardando-finalizacao

aguardando-finalizacao --finalizeTurn-->
   ├─ mayRollAgain (dupla válida) → aguardando-rolagem  [mesmo jogador]
   └─ senão                       → encerrado → próximo seat (pula eliminados/paused)
```

**Guardas-chave (mapeiam FRs):**

- `finalizeTurn` bloqueado se `pendingResolve` (FR-007, FR-022).
- `consecutiveDoubles` 0→1→2; ao gerar a **3ª** dupla, desvia à prisão **antes** de mover (FR-015).
- Dupla = `white[0]===white[1]`, ignora Speed Die / Ônibus (FR-014, FR-025).
- `triple` → `chooseTripleDest`, encerra movimento, **nunca** seta `mayRollAgain` (FR-026).
- Sair da prisão por dupla **não** seta `mayRollAgain` (FR-019).
- `paused` ⇒ todo comando é no-op (FR-028).

---

## 3. Portas de resolução (a serem implementadas por specs irmãs)

`resolution.ts` mapeia `SquareKind → ResolutionHandler`. Assinatura:

```ts
type ResolutionOutcome = { done: boolean; blocksFinalize?: boolean }
type ResolutionHandler = (ctx: ResolveCtx) => ResolutionOutcome

interface ResolveCtx {
  playerId: string
  square: Square        // de boardData.ts (001): pos, kind, group, price...
  roll: Roll            // p/ utilidades (valor dos dados, FR-027) e Ônibus
  ports: TurnPorts
}
```

| `kind` | Handler | Spec dona | Status no 002 |
|---|---|---|---|
| `property` | `resolveProperty` (compra/leilão/aluguel) | Compra & Aluguel | **stub** (no-op resolvido) |
| `airport` / `utility` | `resolveRentable` | Compra & Aluguel + Balanceamento (Hangar) | **stub** |
| `acaso` / `tesouro` | `drawCard` | Sistema de Cartas | **stub** |
| `tax` | debita e `onPayToCenter(amount)` | Balanceamento (Free Parking) | **parcial** (chama porta) |
| `bus-ticket` | `grantBusTicket` | Bus Tickets (estrutura 001) | **stub** |
| `corner-go` | `onPassGo` (crédito) | Balanceamento (GO Progressivo) | **parcial** (chama porta) |
| `corner-parking` | coleta pote | Balanceamento (Free Parking) | **parcial** (chama porta) |
| `corner-jail` | apenas visitando / preso | **Turno** | **completo** |
| `corner-gotojail` | → prisão, sem GO | **Turno** | **completo** |

### Portas externas (`TurnPorts`)

```ts
interface TurnPorts {
  onPassGo(playerId: string): number          // valor do bônus (Balanceamento). UI mostra só o número (princ. IV)
  onPayToCenter(amount: number): void         // imposto/multa/$50 prisão → centro (Balanceamento)
  isEliminated(playerId: string): boolean      // Falência — pular na ordem
  // snapshot/restore/pausa: Sessão & Resiliência (operam sobre o GameState serializável)
}
```

> Até a spec dona existir, o handler é um **stub** que retorna `{ done: true }` (não trava o ciclo). Isso permite testar a **orquestração** do turno isoladamente, antes das mecânicas.

---

## 4. Conformidade

- **Determinismo:** dado o mesmo `(GameState, comando, rng)`, o resultado é único (testável).
- **Serialização:** o contrato não introduz estado não-serializável; portas são injetadas no store, **não** persistidas no `GameState`.
- **Fronteira de spec:** nenhum handler de mecânica irmã é implementado aqui — só a casca de orquestração + os 2 cantos de prisão.
