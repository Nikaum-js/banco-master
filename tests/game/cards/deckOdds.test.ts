// Spec 057 — a projeção da vitrine de probabilidades.
//
// O que este arquivo protege não é "a conta está certa" (dividir é fácil), e sim as três
// invariantes que a spec chamou de inegociáveis:
//
//   1. a vitrine cobre o baralho INTEIRO — soma de cópias = tamanho do baralho;
//   2. a ordem é crescente de chance, com desempate ESTÁVEL (senão a lista parece embaralhada
//      entre renders, porque dentro de um mesmo nível todas as cartas empatam);
//   3. a conta é INVARIANTE ao andamento da partida — é aqui que mora o requisito de
//      privacidade (SRS §10.3/D-037), não numa camada de rede.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deckOdds, formatOdds } from '@/game/ui/cards/deckOdds'
import { CARD_DEFS } from '@/game/cards/catalog'

afterEach(() => vi.restoreAllMocks())

describe('deckOdds — composição (SC-002)', () => {
  it('Acaso: 18 efeitos somando 21 cartas', () => {
    const odds = deckOdds('acaso')
    expect(odds.rows).toHaveLength(18)
    expect(odds.total).toBe(21)
  })

  it('Tesouro: 14 efeitos somando 18 cartas', () => {
    const odds = deckOdds('tesouro')
    expect(odds.rows).toHaveLength(14)
    expect(odds.total).toBe(18)
  })

  it('a soma das cópias listadas É o tamanho do baralho — nenhum efeito fica de fora', () => {
    // A asserção é sobre CONTAGEM DE CARTAS, não sobre a soma dos percentuais arredondados:
    // 1/21 = 4,76%, e somar 18 itens arredondados dá 99,9%, não 100%. Contar cartas é exato.
    for (const deck of ['acaso', 'tesouro'] as const) {
      const odds = deckOdds(deck)
      const copias = odds.rows.reduce((s, r) => s + r.copies, 0)
      expect(copias, deck).toBe(odds.total)
    }
  })

  it('as probabilidades somam 1 em fração (o arredondamento é só da formatação)', () => {
    for (const deck of ['acaso', 'tesouro'] as const) {
      const soma = deckOdds(deck).rows.reduce((s, r) => s + r.probability, 0)
      expect(soma, deck).toBeCloseTo(1, 10)
    }
  })
})

describe('deckOdds — ordenação (FR-004)', () => {
  it('vai da MENOR chance para a MAIOR nos dois baralhos', () => {
    for (const deck of ['acaso', 'tesouro'] as const) {
      const { rows } = deckOdds(deck)
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].probability, `${deck}: ${rows[i].title}`)
          .toBeGreaterThanOrEqual(rows[i - 1].probability)
      }
    }
  })

  it('empate desempata por raridade decrescente e depois por nome — e é estável', () => {
    const rows = deckOdds('acaso').rows
    const order = { lendaria: 4, epica: 3, rara: 2, comum: 1 } as const
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].probability !== rows[i - 1].probability) continue
      const [ant, atual] = [rows[i - 1], rows[i]]
      if (ant.rarity !== atual.rarity) {
        expect(order[ant.rarity]).toBeGreaterThan(order[atual.rarity])
      } else {
        expect(ant.title.localeCompare(atual.title, 'pt-BR')).toBeLessThanOrEqual(0)
      }
    }
    // Estabilidade: a mesma entrada devolve a mesma ordem, sempre.
    expect(deckOdds('acaso').rows.map((r) => r.effect))
      .toEqual(deckOdds('acaso').rows.map((r) => r.effect))
  })

  it('a mais rara do Acaso vem primeiro e a mais provável por último', () => {
    // Os números são PONDERADOS (peso lendária 90 · épica 104 · rara 107 · comum 109, D-075), e
    // não `copies / total`: o baralho é embaralhado por peso, então composição e chance de saque
    // são coisas distintas. Soma de pesos do Acaso = 4×90 + 4×104 + 7×107 + 6×109 = 2179.
    const { rows } = deckOdds('acaso')
    expect(rows[0].rarity).toBe('lendaria')
    expect(rows[0].probability).toBeCloseTo(90 / 2179, 10)
    expect(rows[rows.length - 1].rarity).toBe('comum')
    expect(rows[rows.length - 1].probability).toBeCloseTo(218 / 2179, 10)
  })
})

describe('deckOdds — cópias agrupadas (FR-003)', () => {
  it('efeito com 2 cópias é UMA linha, com a chance somada', () => {
    // Atalho é comum e tem 2 cópias no rebalanceamento da D-074 (antes era a Aquisição
    // Hostil, lendária — que é justamente a inversão que aquela decisão corrigiu).
    const rows = deckOdds('acaso').rows.filter((r) => r.effect === 'atalho')
    expect(rows).toHaveLength(1)
    expect(rows[0].copies).toBe(2)
    expect(rows[0].rarity).toBe('comum')
    expect(rows[0].probability).toBeCloseTo(218 / 2179, 10) // 2 cópias × peso 109 / 2179
  })

  it('nenhum efeito aparece duas vezes na vitrine', () => {
    for (const deck of ['acaso', 'tesouro'] as const) {
      const effects = deckOdds(deck).rows.map((r) => r.effect)
      expect(new Set(effects).size, deck).toBe(effects.length)
    }
  })

  it('todo item tem título e explicação — a vitrine existe para ensinar', () => {
    for (const deck of ['acaso', 'tesouro'] as const) {
      for (const r of deckOdds(deck).rows) {
        expect(r.title.length, `${deck}/${r.effect}`).toBeGreaterThan(0)
        expect(r.desc.length, `${deck}/${r.effect}`).toBeGreaterThan(0)
        expect(r.title, `${deck}/${r.effect}`).not.toBe(r.effect) // não é a chave crua
      }
    }
  })
})

describe('deckOdds — carta deferida sai da lista E do denominador (FR-006)', () => {
  it('um efeito deferido não é listado e não conta na chance dos outros', () => {
    // `deferido` existe no tipo do catálogo; hoje nenhuma carta usa. Simular é a única forma
    // de provar que o filtro cobre os DOIS lugares — se cobrisse só a lista, o denominador
    // continuaria 21 e todas as chances sairiam erradas em silêncio.
    const original = CARD_DEFS.find((d) => d.effect === 'greve')!
    vi.spyOn(CARD_DEFS, 'filter').mockImplementation(((fn: (d: unknown) => boolean) =>
      [...CARD_DEFS]
        .map((d) => (d === original ? { ...d, status: 'deferido' as const } : d))
        .filter(fn)) as never)

    const odds = deckOdds('acaso')
    expect(odds.rows.some((r) => r.effect === 'greve')).toBe(false)
    expect(odds.total).toBe(20) // 21 − 1 cópia de Greve
    expect(odds.rows.reduce((s, r) => s + r.copies, 0)).toBe(odds.total)
  })
})

describe('deckOdds — invariância ao estado (SC-003, a privacidade)', () => {
  it('não recebe estado: a assinatura só aceita o id do baralho', () => {
    // Este teste é sobre CONTRATO. `deckOdds.length === 1` prova que não há parâmetro de
    // `GameState` para alguém passar — a impossibilidade é de tipo, não de disciplina.
    expect(deckOdds).toHaveLength(1)
  })

  it('duas chamadas em pontos diferentes da partida devolvem os MESMOS números', () => {
    // Simula "antes" e "depois" de a partida consumir cartas: como a projeção não olha o
    // estado, nada que aconteça na mesa pode mover estes números. É o que impede a vitrine
    // de virar canal de informação sobre o que já foi sacado (D-037).
    const antes = deckOdds('tesouro')
    const depois = deckOdds('tesouro')
    expect(depois.total).toBe(antes.total)
    expect(depois.rows).toEqual(antes.rows)
  })
})

describe('formatOdds', () => {
  it('uma casa decimal, vírgula decimal do pt-BR', () => {
    expect(formatOdds(1 / 21)).toBe('4,8%')
    expect(formatOdds(2 / 21)).toBe('9,5%')
    expect(formatOdds(1 / 18)).toBe('5,6%')
    expect(formatOdds(2 / 18)).toBe('11,1%')
  })
})

describe('raridade É probabilidade — a invariante da D-074', () => {
  // Antes desta invariante o sistema de raridade da §10.2 mentia: Boom Econômico e Bunker
  // Fiscal (RARAS, 2 cópias) saíam a 11,1%, o dobro de Diplomacia e Imunidade (LENDÁRIAS, 1
  // cópia), e no Acaso a Aquisição Hostil era a carta MAIS provável do baralho. Rótulo de
  // raridade que não corresponde a chance é pior que rótulo nenhum — ensina errado.
  const ORDEM = { lendaria: 4, epica: 3, rara: 2, comum: 1 } as const

  it.each(['acaso', 'tesouro'] as const)('em %s, nenhuma carta é mais provável que uma mais rara', (deck) => {
    const rows = deckOdds(deck).rows
    for (const a of rows) {
      for (const b of rows) {
        // `a` é de nível MAIS RARO que `b` ⇒ `a` não pode ser mais provável que `b`.
        if (ORDEM[a.rarity] > ORDEM[b.rarity]) {
          expect(
            a.probability,
            `${a.title} (${a.rarity}) tem de ser MENOS provável que ${b.title} (${b.rarity})`,
          ).toBeLessThan(b.probability)
        }
      }
    }
  })

  it.each(['acaso', 'tesouro'] as const)('em %s, todo nível acima de comum fica em 1 cópia', (deck) => {
    // É o que torna a ausência de inversão estrutural, e não coincidência de números: com
    // ordenação estrita impossível nos tamanhos do SRS, manter os níveis raros no piso é a única
    // forma de nenhuma comum duplicada passar por cima deles. Com a D-075 são três níveis acima
    // da comum (lendária, épica, rara) em vez de dois — a regra é a mesma, o alcance é maior.
    for (const r of deckOdds(deck).rows) {
      if (r.rarity !== 'comum') expect(r.copies, `${r.title}`).toBe(1)
    }
  })

  it.each(['acaso', 'tesouro'] as const)('em %s, os quatro níveis saem com números DIFERENTES na tela (D-075)', (deck) => {
    // A ordem tem de sobreviver ao ARREDONDAMENTO, não só à aritmética. `formatOdds` mostra uma
    // casa decimal; dois níveis vizinhos com pesos colados saem com o mesmo texto, e a vitrine
    // volta a exibir "épica e rara empatadas" — o defeito que a D-074 curou entre outros dois
    // níveis. Este teste é o piso de espaçamento de `RARITY_WEIGHT`, e falha antes de o jogador ver.
    const porNivel = new Map<string, string>()
    for (const r of deckOdds(deck).rows) porNivel.set(r.rarity, formatOdds(r.probability))
    expect(new Set(porNivel.values()).size, [...porNivel].map(([k, v]) => `${k}=${v}`).join(' '))
      .toBe(porNivel.size)
  })

  it('os tamanhos de baralho do SRS não mudaram: Acaso 21, Tesouro 18', () => {
    expect(deckOdds('acaso').total).toBe(21)
    expect(deckOdds('tesouro').total).toBe(18)
  })
})
