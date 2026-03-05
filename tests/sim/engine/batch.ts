// Fatiamento do lote headless entre runners (036/FR-001, extensão de CI).
//
// O lote de cada contagem roda dentro de UM `it()` síncrono, então o vitest só paraleliza
// por ARQUIVO: 2p, 3p e 6p em três processos, e o de 6 jogadores segura o relógio sozinho
// enquanto os outros dois já terminaram e deixam core ocioso. Medido em runner de 4 vCPUs:
// `SIM_GAMES=30` fecha em ~231s, dos quais o 6p responde por praticamente todos.
//
// `SIM_SHARD=i/n` corta as seeds de CADA contagem em n fatias contíguas e devolve só a
// i-ésima. Com uma matrix de 3 shards, as 90 partidas da amostra se espalham por três
// runners em vez de se empilharem num só — e o 6p, que era o caminho crítico, vira 1/3 dele.
//
// O corte é por SEED, não por contagem de jogadores: fatiar por contagem manteria o 6p
// inteiro num runner e não resolveria nada.

const DEFAULT_GAMES = 100

export type Batch = {
  /** Partidas DESTE shard. */
  games: number
  /** Seeds deste shard — contíguas, derivadas da seed-base da contagem (FR-003). */
  seeds: number[]
  /** Tamanho do lote completo, somando todos os shards. */
  totalGames: number
  /** Descrição para o nome do `it()` — diz a fatia quando há mais de uma. */
  label: string
  /**
   * Teto PROPORCIONAL à fatia, não ao lote inteiro. É guarda contra trava, nunca medida de
   * desempenho (SC-002 pede <2min em condições normais; 180s reprovava um lote SADIO em
   * runner compartilhado). Um teto fixo já reprovou o caminho `full_simulation` por relógio,
   * sempre, sem nada de errado com o motor.
   */
  timeoutMs: number
}

function parseShard(raw: string | undefined): { index: number; total: number } {
  if (!raw) return { index: 1, total: 1 }

  const match = /^(\d+)\/(\d+)$/.exec(raw.trim())
  if (!match) {
    throw new Error(`SIM_SHARD inválido: "${raw}". Formato esperado: "i/n" (1-based), ex. "2/3".`)
  }

  const index = Number(match[1])
  const total = Number(match[2])
  if (total < 1 || index < 1 || index > total) {
    throw new Error(`SIM_SHARD fora de faixa: "${raw}". Exige 1 <= i <= n e n >= 1.`)
  }

  return { index, total }
}

function describeSlice(slice: {
  games: number
  totalGames: number
  index: number
  total: number
  start: number
  end: number
}): string {
  const { games, totalGames, index, total, start, end } = slice
  if (total === 1) return `${totalGames} partidas`
  // Fatia vazia acontece com mais shards que partidas (lote curto de depuração). Vale dizer
  // isso em vez de imprimir uma faixa invertida.
  if (games === 0) return `nenhuma partida (shard ${index}/${total} de um lote de ${totalGames})`
  return `${games} das ${totalGames} partidas (shard ${index}/${total}, seeds ${start}–${end - 1})`
}

/**
 * Resolve a fatia de seeds que este processo deve rodar.
 *
 * `SIM_GAMES` continua sendo o lote COMPLETO por contagem (default 100, o que dá confiança
 * antes de release); `SIM_SHARD` só decide qual pedaço dele cabe a este runner. Sem
 * `SIM_SHARD`, o comportamento é o de sempre: uma fatia só, o lote inteiro.
 */
export function resolveBatch(baseSeed: number): Batch {
  const totalGames = Number(process.env.SIM_GAMES) || DEFAULT_GAMES
  const { index, total } = parseShard(process.env.SIM_SHARD)

  // Fronteiras por proporção: distribui o resto sem sobrepor nem pular seed alguma, e
  // `n > totalGames` só produz fatias vazias no fim, em vez de erro.
  const start = Math.floor(((index - 1) * totalGames) / total)
  const end = Math.floor((index * totalGames) / total)
  const games = end - start

  return {
    games,
    seeds: Array.from({ length: games }, (_, i) => baseSeed + start + i),
    totalGames,
    label: describeSlice({ games, totalGames, index, total, start, end }),
    timeoutMs: Math.max(600_000, games * 15_000),
  }
}

/**
 * Caminho do relatório. Shards escrevem arquivos distintos porque rodar dois no MESMO disco
 * (matrix local, depuração) faria o segundo sobrescrever o primeiro em silêncio.
 */
export function reportPath(base: string): string {
  const { index, total } = parseShard(process.env.SIM_SHARD)
  return total === 1 ? base : `${base}-shard${index}of${total}`
}
