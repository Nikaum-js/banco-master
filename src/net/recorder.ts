// Gravação/replay do não-determinismo (spec 037, FR-011; 043, D8).
//
// Os reducers do motor consomem `ctx.rng()` (dados brancos + Fiscal/Tax Man), `ctx.now()`
// (deadlines de leilão) e `ctx.ports.draw()` (saque de carta — 043). Os dois primeiros são
// não-determinismo "de verdade" (relógio/aleatoriedade real). O saque é diferente: no HOST o
// deck está sempre completo (a ordem é determinística ali), mas na perspectiva de um CLIENTE
// o deck é oculto (`null`) — então o valor que `state.decks[deckId].shift()` devolve LÁ não é
// o real. Por isso o saque entra pelo MESMO mecanismo de gravação/replay que `rng`/`now`
// (descoberta do D8 do plan: o vazamento da mão nunca esteve na difusão, estava na ordem do
// deck que todo mundo lia no primeiro snapshot).
//
// O HOST aplica cada comando com um `recordingCtx`, que embrulha `rng`/`now`/`ports.draw` e
// GRAVA cada valor consumido, em ordem. O comando aceito difundido carrega esses valores
// (`Resolved`) — `draws` redigido (D9/D10) para quem não é o dono da carta, íntegro para quem
// é. Cada CLIENTE aplica o mesmo comando com um `replayCtx`, que devolve os valores gravados
// na ordem — sem jamais chamar `Math.random()`/`Date.now()` nem confiar no `shift()` local do
// deck oculto. Como o reducer é determinístico dado o estado e as saídas de `ctx`, host e
// clientes convergem exatamente — a regra é uma só nos dois lados: valor não-nulo → carta
// conhecida; valor nulo → slot oculto.
import type { TurnCtx } from '@/game/turn/turnMachine'
import type { CardSlot } from '@/game/cards/types'

export interface Resolved {
  rng: number[] // valores de `ctx.rng()` consumidos, em ordem
  now: number[] // valores de `ctx.now()` consumidos, em ordem
  draws: CardSlot[] // 043, D8 — cartas sacadas nesta aplicação (`ctx.ports.draw()`), em ordem
  // 043 — achado ao implementar D11: abrir a janela de reação depende de olhar a mão do
  // REATOR (não de quem está aplicando o comando) — mesmo problema do saque, mesma solução:
  // grava o resultado de `ports.hasReaction()`, nunca deixa cada perspectiva perguntar de
  // novo (perguntas diferentes dariam respostas diferentes e quebrariam a convergência).
  reactions: CardSlot[]
}

// Embrulha `base` gravando cada `rng()`/`now()`/`ports.draw()`/`ports.hasReaction()`
// consumido. `drain()` devolve uma cópia dos valores gravados até então.
export function recordingCtx(base: TurnCtx): { ctx: TurnCtx; drain: () => Resolved } {
  const rng: number[] = []
  const now: number[] = []
  const draws: CardSlot[] = []
  const reactions: CardSlot[] = []
  const baseNow = base.now ?? (() => 0)
  const ctx: TurnCtx = {
    ...base,
    rng: () => {
      const v = base.rng()
      rng.push(v)
      return v
    },
    now: () => {
      const v = baseNow()
      now.push(v)
      return v
    },
    ports: {
      ...base.ports,
      draw: (state, deckId) => {
        const v = base.ports.draw(state, deckId)
        draws.push(v)
        return v
      },
      hasReaction: (state, playerId, effect) => {
        const v = base.ports.hasReaction(state, playerId, effect)
        reactions.push(v)
        return v
      },
    },
  }
  return { ctx, drain: () => ({ rng: rng.slice(), now: now.slice(), draws: draws.slice(), reactions: reactions.slice() }) }
}

// Embrulha `base` devolvendo os valores gravados na ordem. Underflow (mais consumo que o
// gravado) é bug de convergência — falha alto em vez de escorregar para o RNG real/deck local.
export function replayCtx(base: TurnCtx, resolved: Resolved): TurnCtx {
  const rng = [...resolved.rng]
  const now = [...resolved.now]
  const draws = [...resolved.draws]
  const reactions = [...resolved.reactions]
  return {
    ...base,
    rng: () => {
      if (rng.length === 0) throw new Error('replayCtx: RNG underflow — divergência host/cliente')
      return rng.shift()!
    },
    now: () => {
      if (now.length === 0) throw new Error('replayCtx: relógio underflow — divergência host/cliente')
      return now.shift()!
    },
    ports: {
      ...base.ports,
      draw: (state, deckId) => {
        base.ports.draw(state, deckId) // shift local pelo efeito (comprimento) — valor descartado
        if (draws.length === 0) throw new Error('replayCtx: draws underflow — divergência host/cliente')
        return draws.shift()!
      },
      hasReaction: () => {
        // Sem efeito colateral a replicar (é um lookup puro) — só devolve o gravado.
        if (reactions.length === 0) throw new Error('replayCtx: reactions underflow — divergência host/cliente')
        return reactions.shift()!
      },
    },
  }
}
