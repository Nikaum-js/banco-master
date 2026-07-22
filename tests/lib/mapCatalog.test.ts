// Spec 055 (D-069) — o catálogo de mapas é apresentação sobre um esqueleto econômico
// único. Estes testes são o contrato: se a Fuligem divergir do Atlas em QUALQUER campo
// econômico, o mapa deixou de ser mapa e virou regra — e isso é proibido.
import { describe, expect, it } from 'vitest'
import { BOARD, GROUPS, type GroupKey, type PropertySquare } from '@/lib/boardData'
import { BOARD_IDS, catalogOf, coerceBoardId } from '@/lib/mapCatalog'

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

  it('o board do atlas É o BOARD (mesma referência, apresentação intacta)', () => {
    expect(catalogOf('atlas').board).toBe(BOARD)
    for (const key of Object.keys(GROUPS) as GroupKey[]) {
      expect(catalogOf('atlas').groupNames[key]).toBe(GROUPS[key].name)
    }
  })
})

describe('mapCatalog — paridade econômica da Fuligem (FR-002)', () => {
  const fuligem = catalogOf('fuligem').board

  it('48 casas, mesmas posições, mesmos tipos', () => {
    expect(fuligem).toHaveLength(BOARD.length)
    BOARD.forEach((sq, i) => {
      expect(fuligem[i].pos).toBe(sq.pos)
      expect(fuligem[i].kind).toBe(sq.kind)
    })
  })

  it('propriedades: mesmo grupo, preço e aluguel-base em cada posição', () => {
    BOARD.forEach((sq, i) => {
      if (sq.kind !== 'property') return
      const other = fuligem[i] as PropertySquare
      expect(other.group).toBe(sq.group)
      expect(other.price).toBe(sq.price)
      expect(other.rent).toBe(sq.rent)
    })
  })

  it('aeroportos, utilidades e impostos: mesmos preços/valores', () => {
    BOARD.forEach((sq, i) => {
      const other = fuligem[i]
      if (sq.kind === 'airport' && other.kind === 'airport') {
        expect(other.price).toBe(sq.price)
        expect(other.rent).toBe(sq.rent)
      }
      if (sq.kind === 'utility' && other.kind === 'utility') {
        expect(other.price).toBe(sq.price)
        expect(other.icon).toBe(sq.icon)
      }
      if (sq.kind === 'tax' && other.kind === 'tax') {
        expect(other.amount).toBe(sq.amount)
      }
    })
  })

  it('nenhuma propriedade da Fuligem tem bandeira; todas têm ícone e bairro', () => {
    for (const sq of fuligem) {
      if (sq.kind !== 'property') continue
      expect(sq.uf).toBeUndefined()
      expect(sq.icon).toBeTruthy()
      expect(sq.capital).toBe(catalogOf('fuligem').groupNames[sq.group])
    }
  })

  it('nomes únicos nas 28 propriedades', () => {
    const names = fuligem.filter((s) => s.kind === 'property').map((s) => s.name)
    expect(new Set(names).size).toBe(28)
  })
})

describe('mapCatalog — vocabulário aprovado da Fuligem (FR-007)', () => {
  const { board, labels } = catalogOf('fuligem')
  const at = (pos: number) => board.find((s) => s.pos === pos)!

  it('cantos: GO e Prisão preservados; Sorte Grande no 24', () => {
    expect(at(0).name).toBe('GO')
    expect(at(12).name).toContain('Prisão')
    expect(at(24).name).toBe('Sorte Grande')
    expect(at(36).name).toBe('Vá para Prisão')
  })

  it('ferrovias nos 4 aeroportos, nomeadas por lado', () => {
    expect(at(6).name).toBe('Ferrovia Sul')
    expect(at(18).name).toBe('Ferrovia Oeste')
    expect(at(30).name).toBe('Ferrovia Norte')
    expect(at(42).name).toBe('Ferrovia Leste')
  })

  it('utilidades e impostos nomeados pelo brief', () => {
    expect(at(14).name).toBe('Mina de Carvão')
    expect(at(32).name).toBe('Usina Elétrica')
    expect(at(43).name).toBe('Companhia de Água')
    expect(at(4).name).toBe('Imposto da Cidade')
    expect(at(45).name).toBe('Taxa de Fumaça')
  })

  it('Acaso e Tesouro mantêm os nomes canônicos', () => {
    for (const sq of board) {
      if (sq.kind === 'acaso') expect(sq.name).toBe('Acaso')
      if (sq.kind === 'tesouro') expect(sq.name).toBe('Tesouro')
    }
    expect(at(10).name).toBe('Bilhete de Trem')
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

  it('10 bairros com os nomes do brief', () => {
    expect(Object.values(catalogOf('fuligem').groupNames)).toEqual([
      'Bairro da Fumaça',
      'Bairro das Fábricas',
      'Bairro do Ferro',
      'Porto do Vapor',
      'Vila dos Trabalhadores',
      'Bairro das Máquinas',
      'Bairro dos Trens',
      'Bairro da Energia',
      'Centro da Cidade',
      'Bairro dos Magnatas',
    ])
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
