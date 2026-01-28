// Os 5 testes obrigatórios do contrato (044, T039):
// specs/044-polimento-lancamento/contracts/telemetry-port.md#testes-obrigatórios-teststelemetry
import { describe, expect, it, vi } from 'vitest'
import { nullTelemetry, type TelemetryEvent } from '@/telemetry/port'
import { resolveTelemetry } from '@/telemetry'
import { createSupabaseSink, type TelemetrySupabaseLike } from '@/telemetry/supabaseSink'
import { matchKey } from '@/telemetry/matchKey'
import { allowlistFields } from '@/telemetry/sentryAllowlist'

describe('1. resolveTelemetry() sem ambiente configurado (T5/FR-038)', () => {
  it('devolve nullTelemetry — o adaptador de rede nunca chega a ser criado', () => {
    const result = resolveTelemetry({
      dev: false,
      configured: false,
      createSink: () => { throw new Error('nenhum adaptador deveria ser construído sem ambiente') },
    })
    expect(result).toBe(nullTelemetry)
    // `track` segue utilizável e inofensivo — nenhuma chamada de rede é feita.
    expect(() => result.track({ kind: 'room_created', matchKey: 'x' })).not.toThrow()
  })

  it('em DEV, é sempre nullTelemetry — mesmo com o destino configurado (T6)', () => {
    const result = resolveTelemetry({
      dev: true,
      configured: true,
      createSink: () => { throw new Error('DEV nunca deveria construir um adaptador') },
    })
    expect(result).toBe(nullTelemetry)
  })

  it('fora de DEV e configurado, delega ao adaptador informado', () => {
    const sink = { track: vi.fn() }
    const result = resolveTelemetry({ dev: false, configured: true, createSink: () => sink })
    expect(result).toBe(sink)
  })
})

describe('2. track com o adaptador Supabase falhando (T1/T2/FR-037)', () => {
  it('não lança, não repete e não bloqueia o chamador', async () => {
    const insert = vi.fn(() => Promise.reject(new Error('rede fora do ar')))
    const supabase: TelemetrySupabaseLike = { from: () => ({ insert }) }
    const sink = createSupabaseSink(supabase)

    expect(() => sink.track({ kind: 'match_started', matchKey: 'abc123', players: 3 })).not.toThrow()

    // Deixa o microtask da rejeição drenar sem virar unhandled rejection nem repetir.
    await Promise.resolve()
    await Promise.resolve()
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('mesmo se o cliente subjacente lançar SÍNCRONO ao montar a chamada, `track` não propaga', () => {
    const supabase: TelemetrySupabaseLike = {
      from: () => { throw new Error('cliente mal configurado') },
    }
    const sink = createSupabaseSink(supabase)
    expect(() => sink.track({ kind: 'match_paused', matchKey: 'abc123', cause: 'disconnect' })).not.toThrow()
  })
})

describe('3. serialização de cada variante de evento não carrega dado sensível (FR-035)', () => {
  it('nenhuma string sentinela (nome, token, código de reentrada, id de sala) sobrevive', async () => {
    const NAME_SENTINEL = 'Ana Sentinela'
    const TOKEN_SENTINEL = 'tok-secreto-abcdef123456'
    const REENTRY_SENTINEL = 'XYZ789'
    const ROOM_ID_SENTINEL = `sala-${NAME_SENTINEL}-${TOKEN_SENTINEL}-${REENTRY_SENTINEL}`

    // O `roomId` é o único insumo "contaminado" possível — é o que vira `matchKey` por hash.
    const key = await matchKey(ROOM_ID_SENTINEL)

    const events: TelemetryEvent[] = [
      { kind: 'room_created', matchKey: key },
      { kind: 'match_started', matchKey: key, players: 4 },
      { kind: 'match_ended', matchKey: key, players: 4, rounds: 12, durationMs: 900_000 },
      { kind: 'match_paused', matchKey: key, cause: 'disconnect' },
    ]

    const sentinels = [NAME_SENTINEL, TOKEN_SENTINEL, REENTRY_SENTINEL, ROOM_ID_SENTINEL]
    for (const event of events) {
      const json = JSON.stringify(event)
      for (const sentinel of sentinels) expect(json).not.toContain(sentinel)
    }
  })
})

describe('4. matchKey é derivado, estável e irreversível (T4/FR-036)', () => {
  it('é o mesmo para o mesmo roomId e diferente para outro', async () => {
    const a1 = await matchKey('sala-1')
    const a2 = await matchKey('sala-1')
    const b = await matchKey('sala-2')
    expect(a1).toBe(a2)
    expect(a1).not.toBe(b)
  })

  it('o resultado não contém o roomId como substring', async () => {
    const roomId = 'sala-credencial-de-acesso-9f8e7d'
    const key = await matchKey(roomId)
    expect(key).not.toContain(roomId)
  })
})

describe('5. beforeSend do Sentry aplica lista de PERMISSÃO (T5 do contrato)', () => {
  it('descarta qualquer campo fora da lista — objeto com chave `hand` some', () => {
    const filtered = allowlistFields({
      occurrenceId: 'ABC123',
      where: 'match',
      phase: 'playing',
      seq: 42,
      message: 'algo quebrou',
      version: 'sha-deadbeef',
      hand: ['carta-1', 'carta-2'],
      playerName: 'Ana',
    })
    expect(filtered).toEqual({
      occurrenceId: 'ABC123',
      where: 'match',
      phase: 'playing',
      seq: 42,
      message: 'algo quebrou',
      version: 'sha-deadbeef',
    })
    expect(filtered).not.toHaveProperty('hand')
    expect(filtered).not.toHaveProperty('playerName')
  })
})
