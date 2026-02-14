// Toda carta imediata EXPLICA o que aconteceu — inclusive quando não aconteceu nada.
//
// Vem de um relato de partida: "Jogador 2: nenhum efeito". O SRS §10.6 permite que cartas
// dependentes de estado não movimentem caixa (Incentivo Fiscal sem hipoteca, Resgate do Pote
// vazio) — mas permitir o EFEITO nulo não é permitir a NARRAÇÃO nula. Carta que sai, turno que
// segue e nada dito parece bug para quem está jogando.
//
// Efeitos persistentes também têm delta 0 por natureza e precisam dizer o que ativaram.
import { describe, expect, it } from 'vitest'
import { describeLogEntry } from '@/game/ui/log/describeLog'
import type { LogEntry } from '@/game/economy/types'

/** A frase inteira, incluindo os fragmentos de dinheiro.
 *
 * `describeLogEntry` devolve fragmentos tipados — `{t:'text'}` e `{t:'money'}` —, e o valor mora
 * no segundo. Serializar tudo é mais robusto que ler campo por campo: o teste quer saber o que o
 * jogador LÊ, não a forma interna do fragmento. */
function frase(name: string, delta: number): string {
  const entry = { kind: 'card-immediate', who: 'p1', name, delta } as unknown as LogEntry
  return JSON.stringify(describeLogEntry(entry, null))
}

const SEM_ALVO_OU_VALOR = [
  'Incentivo Fiscal',
  'Resgate Do Pote',
  'Conserto Imoveis',
  'Aniversario',
]

describe('narração de carta imediata sem efeito', () => {
  it.each(SEM_ALVO_OU_VALOR)('%s com delta 0 explica POR QUE não movimentou caixa', (name) => {
    const t = frase(name, 0)
    expect(t.length, name).toBeGreaterThan(20) // não é frase-carimbo
    expect(t, name).toMatch(/mas |porque|não havia|vazio|não encontrou/i)
  })

  it.each([
    ['Obra Relampago', /próxima construção será gratuita/i],
    ['Estatizacao', /1 volta.*aluguel.*Loteria/i], // D-080: era 2 voltas
    ['Greve', /bônus.*suspenso.*utilidades sem aluguel/i],
    ['Crise Imobiliaria', /adversários.*10%.*Loteria/i],
  ])('%s com delta 0 narra o efeito não monetário', (name, expected) => {
    expect(frase(name, 0)).toMatch(expected)
  })

  it('nenhuma carta imediata produz a frase vazia "nenhum efeito"', () => {
    for (const name of [
      ...SEM_ALVO_OU_VALOR,
      'Obra Relampago',
      'Estatizacao',
      'Crise Imobiliaria',
      'Erro Banco',
      'Greve',
      'Multa Ambiental',
    ]) {
      for (const delta of [-100, 0, 100]) {
        expect(frase(name, delta), `${name}/${delta}`).not.toContain('nenhum efeito')
      }
    }
  })

  it('carta desconhecida com delta 0 ainda diz algo útil, não silêncio', () => {
    // O ramo de último recurso: sem saber qual carta é, a única coisa verdadeira é que não
    // houve movimento de caixa. Melhor que "nenhum efeito", e honesto.
    const t = frase('Carta Que Nao Existe', 0)
    expect(t).toMatch(/não movimentou dinheiro/i)
    expect(t).not.toContain('nenhum efeito')
  })

  it('com delta diferente de zero, o valor aparece', () => {
    expect(frase('Incentivo Fiscal', 150)).toMatch(/150/)
    expect(frase('Resgate Do Pote', 300)).toMatch(/300/)
  })
})
