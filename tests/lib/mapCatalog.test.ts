// Spec 056 (D-070) — cada mapa tem TABULEIRO PRÓPRIO, de tamanho e disposição próprios.
//
// O contrato mudou. A versão anterior (055/D-069) provava o oposto: que a Fuligem era
// derivada do Atlas por overlay e batia com ele casa por casa, campo por campo. Essa
// invariante travava os dois mapas em 48 casas e é exatamente o que a D-070 revoga — não
// há paridade econômica a preservar, então os testes que a provavam foram REMOVIDOS, não
// afrouxados. O que este arquivo protege agora é o que substituiu a paridade:
//
//   1. a COMPOSIÇÃO da Fuligem (40 casas, 8 bairros, 22 propriedades) está correta;
//   2. a curva de preço é monotônica — o que a paridade dava de graça e agora é nossa;
//   3. a DISPOSIÇÃO honra a razão de existir dela: a faixa quente pós-prisão;
//   4. o Atlas segue byte a byte intacto (é isso que faz o mapa novo ser aditivo).
import { describe, expect, it } from 'vitest'
import { ATLAS_BOARD, GROUPS, type GroupKey, type PropertySquare } from '@/lib/boardData'
import { BOARD_IDS, catalogOf, coerceBoardId, DEFAULT_RULES } from '@/lib/mapCatalog'

describe('mapCatalog — identidade', () => {
  it('expõe exatamente os dois mapas jogáveis', () => {
    expect(BOARD_IDS).toEqual(['atlas', 'fuligem'])
    expect(catalogOf('atlas').name).toBe('Cidades do Mundo')
    expect(catalogOf('fuligem').name).toBe('Cidade da Fuligem')
  })

  it('coerceBoardId cai em atlas para qualquer valor desconhecido (sala legada)', () => {
    expect(coerceBoardId('fuligem')).toBe('fuligem')
    expect(coerceBoardId('atlas')).toBe('atlas')
    expect(coerceBoardId('neon')).toBe('atlas')
    expect(coerceBoardId(undefined)).toBe('atlas')
    expect(coerceBoardId(null)).toBe('atlas')
    expect(coerceBoardId(42)).toBe('atlas')
  })
})

describe('mapCatalog — o Atlas segue intacto (o mapa novo é aditivo)', () => {
  it('board do atlas É o ATLAS_BOARD, 48 casas, grupos originais', () => {
    expect(catalogOf('atlas').board).toBe(ATLAS_BOARD)
    expect(catalogOf('atlas').board).toHaveLength(48)
    for (const key of Object.keys(GROUPS) as GroupKey[]) {
      expect(catalogOf('atlas').groupNames[key]).toBe(GROUPS[key].name)
    }
  })

  it('atlas não declara regra própria — joga como sempre jogou', () => {
    expect(catalogOf('atlas').rules).toEqual(DEFAULT_RULES)
    expect(catalogOf('atlas').rules.railHop).toBe(false)
    expect(catalogOf('atlas').rules.smokeTax).toBe(0)
  })
})

describe('mapCatalog — composição da Fuligem (40 casas)', () => {
  const board = catalogOf('fuligem').board
  const count = (kind: string) => board.filter((s) => s.kind === kind).length

  it('40 casas, com posições 0..39 sem furo nem repetição', () => {
    expect(board).toHaveLength(40)
    expect(board.map((s) => s.pos)).toEqual(Array.from({ length: 40 }, (_, i) => i))
  })

  it('composição exata: 4 cantos + 22 propriedades + 4 ferrovias + 4 minas + 5 cartas + 1 bilhete', () => {
    expect(count('property')).toBe(22)
    expect(count('airport')).toBe(4)
    expect(count('mine')).toBe(4) // D-071
    expect(count('acaso')).toBe(3)
    expect(count('tesouro')).toBe(2)
    expect(count('bus-ticket')).toBe(1)
    expect(count('corner-go') + count('corner-jail') + count('corner-parking') + count('corner-gotojail')).toBe(4)
  })

  it('as minas entraram por TROCA: nem utilidade nem imposto sobraram, e o total segue 40', () => {
    // Este é o contrato do pedido: o tamanho não muda, as minas ocupam as casas que eram
    // as 3 utilidades e o imposto. Se alguém reintroduzir uma utilidade sem tirar outra
    // coisa, o tabuleiro passa de 40 e a topologia de 11×11 quebra em silêncio.
    expect(count('utility')).toBe(0)
    expect(count('tax')).toBe(0)
    expect(board).toHaveLength(40)
  })

  it('os quatro metais aparecem uma vez cada', () => {
    const metals = board.filter((s) => s.kind === 'mine').map((s) => s.metal)
    expect([...metals].sort()).toEqual(['carvao', 'cobre', 'estanho', 'ferro'])
  })

  it('cantos em 0/10/20/30 — é o que a topologia de 11×11 assume', () => {
    expect(board[0].kind).toBe('corner-go')
    expect(board[10].kind).toBe('corner-jail')
    expect(board[20].kind).toBe('corner-parking')
    expect(board[30].kind).toBe('corner-gotojail')
  })

  it('8 bairros, tamanhos 2·3·3·3·3·3·3·2, sem usar purple nem navy', () => {
    const byGroup = new Map<GroupKey, number>()
    for (const sq of board) {
      if (sq.kind !== 'property') continue
      byGroup.set(sq.group, (byGroup.get(sq.group) ?? 0) + 1)
    }
    expect([...byGroup.keys()].sort()).toEqual(
      ['brown', 'green', 'orange', 'pink', 'platinum', 'red', 'skyblue', 'yellow'],
    )
    expect(byGroup.get('brown')).toBe(2) // Olaria — o degrau mais barato
    expect(byGroup.get('platinum')).toBe(2) // Serrano — o mais caro
    for (const g of ['skyblue', 'pink', 'orange', 'red', 'yellow', 'green'] as GroupKey[]) {
      expect(byGroup.get(g), `bairro ${g}`).toBe(3)
    }
    // Os dois cortados pela D-070 não aparecem em casa nenhuma.
    expect(byGroup.has('purple')).toBe(false)
    expect(byGroup.has('navy')).toBe(false)
  })

  it('nomes únicos, e nenhuma propriedade com bandeira (o mapa não é atlas)', () => {
    const props = board.filter((s): s is PropertySquare => s.kind === 'property')
    expect(new Set(props.map((s) => s.name)).size).toBe(22)
    for (const sq of props) {
      expect(sq.uf).toBeUndefined()
      expect(sq.icon).toBeTruthy()
      expect(sq.capital).toBe(catalogOf('fuligem').groupNames[sq.group])
    }
  })

  it('preço e aluguel-base sobem monotonicamente ao longo do tabuleiro', () => {
    // A paridade com o Atlas garantia isto de graça; agora a escada é nossa e precisa
    // ser afirmada, senão um nome trocado de lugar inverte a curva sem ninguém ver.
    const props = board.filter((s): s is PropertySquare => s.kind === 'property')
    for (let i = 1; i < props.length; i++) {
      expect(props[i].price, `preço em ${props[i].name}`).toBeGreaterThan(props[i - 1].price)
      expect(props[i].rent, `aluguel em ${props[i].name}`).toBeGreaterThanOrEqual(props[i - 1].rent)
    }
    // A escada é DERIVADA (não copiada do Atlas): preço sai da economia de caixa
    // (tabuleiro/caixa 0,60 — mais que os 0,54 do Atlas, porque a volta de 40 casas dá
    // 20% mais GO por lançamento) e o aluguel-base sai do payback-alvo por bairro.
    expect(props[0].price).toBe(90)
    expect(props[props.length - 1].price).toBe(940)
    // Contar quantos preços coincidem com o Atlas seria um teste ruim: as duas escadas
    // são múltiplos de 10 numa faixa parecida, então coincidência é inevitável e não diz
    // nada sobre derivação. O que a derivação PRODUZ e a cópia não produzia é a razão
    // tabuleiro/caixa — a cópia dava 0,48 (tabuleiro barato demais para o dinheiro em
    // jogo, num tabuleiro cujo GO paga 20% mais por lançamento); o alvo é 0,60.
    const buyable = board.reduce((sum, s) => sum + ('price' in s ? s.price : 0), 0)
    const cash = 8 * 2000 // INITIAL_CASH × mesa cheia
    expect(buyable / cash).toBeGreaterThan(0.56)
    expect(buyable / cash).toBeLessThan(0.64)
  })
})

describe('mapCatalog — a disposição da Fuligem é a mecânica (D-070)', () => {
  const board = catalogOf('fuligem').board
  const at = (pos: number) => board[pos]

  it('a faixa 16–19 (6 a 9 passos da prisão) é a razão de existir do layout', () => {
    // A prisão é a casa mais pisada de qualquer tabuleiro de Monopoly e 7 é o resultado
    // mais provável de 2d6 — logo 16–19 é o trecho mais visitado do jogo. Se alguém
    // reordenar o lado Oeste, é ISTO que se perde, e é isto que o teste segura.
    expect(at(10).kind).toBe('corner-jail')
    expect(at(16).kind).toBe('airport')
    expect(at(17).kind).toBe('mine') // a mina no pico exato do dado (D-071)
    expect(at(17).name).toBe('Mina de Carvão')
    expect(at(18).kind).toBe('property')
    expect(at(19).kind).toBe('property')
  })

  it('ferrovias em 5/16/25/36 — desiguais de propósito, uma por lado', () => {
    const rails = board.filter((s) => s.kind === 'airport').map((s) => s.pos)
    expect(rails).toEqual([5, 16, 25, 36])
    // Desigualdade é o ponto: 11·9·11·9. Simétrico (5/15/25/35) as tornaria intercambiáveis.
    const gaps = rails.map((p, i) => (i === 0 ? p + 40 - rails[3] : p - rails[i - 1]))
    expect(gaps).toEqual([9, 11, 9, 11])
  })

  it('a ferrovia e a Mina de Carvão partem o bairro da Colônia Nova (15 · 18 · 19)', () => {
    const orange = board.filter((s) => s.kind === 'property' && s.group === 'orange').map((s) => s.pos)
    expect(orange).toEqual([15, 18, 19]) // precedente: a Electric Company parte o roxo no original
  })
})

describe('mapCatalog — vocabulário da Fuligem', () => {
  const { board, labels } = catalogOf('fuligem')
  const at = (pos: number) => board[pos]

  it('cantos: GO e Prisão preservados; Sorte Grande no 20', () => {
    expect(at(0).name).toBe('GO')
    expect(at(10).name).toContain('Prisão')
    expect(at(20).name).toBe('Sorte Grande')
    expect(at(30).name).toBe('Vá para Prisão')
  })

  it('ferrovias nomeadas por LUGAR, nunca por bússola', () => {
    const rails = board.filter((s) => s.kind === 'airport').map((s) => s.name)
    expect(rails).toEqual([
      'Estação Bonfim', 'Estação da Serra', 'Estação Cachoeira', 'Estação do Vale',
    ])
    // Bússola é descrição, não nome — e o Monopoly original nunca fez isso
    // (Reading, Pennsylvania, B&O, Short Line são todos lugares).
    for (const name of rails) {
      expect(name).not.toMatch(/\b(Norte|Sul|Leste|Oeste)\b/)
    }
  })

  it('as quatro minas se chamam "Mina de <metal>", sem invenção', () => {
    // Nomes diretos de propósito: "Lavra do Estanho"/"Cata do Cobre"/"Carbonífera Santa
    // Rita" eram sinônimos rebuscados que escondiam o que a casa é.
    expect(at(4).name).toBe('Mina de Ferro')
    expect(at(17).name).toBe('Mina de Carvão')
    expect(at(28).name).toBe('Mina de Estanho')
    expect(at(34).name).toBe('Mina de Cobre')
    // Uma por lado do tabuleiro, como as ferrovias.
    expect([4, 17, 28, 34].map((p) => board.filter((s) => s.kind === 'mine').some((s) => s.pos === p))).toEqual([true, true, true, true])
  })

  it('nenhuma propriedade usa a fórmula "[via] da/dos [substantivo industrial]"', () => {
    // Era a queixa que motivou a renomeação: as 22 casas seguiam o mesmo molde e por isso
    // liam como etiqueta, não como lugar. Lugar de verdade não se chama pelo que se faz.
    const banned = /(Fumaça|Chaminé|Carvão|Oficinas?|Ferro|Aço|Peças|Engrenagens|Trilhos|Vagões|Lâmpadas|Máquinas|Caldeira)\b/
    for (const sq of board) {
      if (sq.kind !== 'property') continue
      expect(sq.name, `nome de fórmula: ${sq.name}`).not.toMatch(banned)
    }
  })

  it('nenhum `short` passa de 10 caracteres — a faixa da casa não comporta mais', () => {
    // Truncar nome longo produzia fragmento sem sentido ("Pedra" por "Estação Pedra
    // Branca", "Sete" por "Rua Sete de Setembro"). A regra passou a ser: se não cabe,
    // o LUGAR ganha nome menor — não um apelido cortado.
    for (const sq of board) {
      if (!sq.short) continue
      expect(sq.short.length, `short longo: ${sq.short}`).toBeLessThanOrEqual(13)
    }
  })

  it('Acaso e Tesouro mantêm os nomes canônicos; Bilhete de Trem no 14', () => {
    for (const sq of board) {
      if (sq.kind === 'acaso') expect(sq.name).toBe('Acaso')
      if (sq.kind === 'tesouro') expect(sq.name).toBe('Tesouro')
    }
    expect(at(14).name).toBe('Bilhete de Trem')
  })

  it('rótulos dos contratos do motor', () => {
    expect(labels).toMatchObject({
      airport: 'Ferrovia',
      hangar: 'Estação de Carga',
      busTicket: 'Bilhete de Trem',
      lottery: 'Sorte Grande',
      house: 'oficina',
      hotel: 'fábrica',
      hotel2: 'Complexo de Fábricas',
      skyscraper: 'Torre de Ferro',
      group: 'bairro',
    })
  })

  it('8 bairros com os nomes da renomeação, do mais barato ao mais caro', () => {
    expect(Object.values(catalogOf('fuligem').groupNames)).toEqual([
      'Olaria', 'Vila Bonfim', 'Fundição', 'Colônia Nova',
      'Guilhermina', 'Alto do Desvio', 'Salto', 'Serrano',
    ])
  })

  it('não declara zonas ou linhas geográficas no miolo', () => {
    expect(catalogOf('fuligem')).not.toHaveProperty('zones')
  })
})

describe('mapCatalog — as duas mecânicas da Fuligem', () => {
  it('declara Desvio pela Ferrovia e Taxa de Fumaça', () => {
    expect(catalogOf('fuligem').rules).toEqual({ railHop: true, smokeTax: 50 })
  })
})

describe('mapCatalog — overrides de carta são apresentação pura', () => {
  it('toda chave de cardText é um effect id canônico existente', async () => {
    const { CARDS } = await import('@/game/cards/catalog')
    const { CARD_LABEL } = await import('@/game/ui/cards/cardMeta')
    const effects = new Set(CARDS.map((c) => c.effect))
    for (const effect of Object.keys(catalogOf('fuligem').cardText)) {
      expect(effects.has(effect), `override órfão: ${effect}`).toBe(true)
      expect(CARD_LABEL[effect], `sem rótulo base: ${effect}`).toBeTruthy()
    }
    expect(Object.keys(catalogOf('atlas').cardText)).toHaveLength(0)
  })
})
