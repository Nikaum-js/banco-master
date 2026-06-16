import { describe, expect, it } from 'vitest'
import { buildInitialGame } from '@/game/setup'
import { splitSnapshot } from '@/net/perspective'
import { createRoom, SEAT_COLORS } from '@/net/room'
import { supabaseTransport, type SupabaseLike } from '@/net/supabaseTransport'
import { fakeSupabase } from './fakeSupabase'
import { mulberry32 } from '../sim/engine/rng'

describe('supabaseTransport — janela de deploy da retenção', () => {
  it('recua de 0007 para 0006 e depois 0005 somente na geração inicial', async () => {
    const fake = fakeSupabase()
    const current = fake.client('uid-host')
    const calls: { fn: string; args: Record<string, unknown> }[] = []
    const legacyBackend: SupabaseLike = {
      channel: current.channel.bind(current),
      from: current.from.bind(current),
      rpc(fn, args) {
        calls.push({ fn, args })
        if (
          (fn === 'write_room' || fn === 'write_snapshot')
          && Object.hasOwn(args, 'match_generation')
        ) {
          return Promise.resolve({
            data: null,
            error: {
              code: 'PGRST202',
              message: `Could not find the function public.${fn}`,
            },
          })
        }
        return current.rpc(fn, args)
      },
    }
    const room = createRoom('sala-legada', {
      uid: 'uid-host',
      name: 'Ana',
      color: SEAT_COLORS[0],
      reentryCode: 'ANAAAA',
    })
    const transport = supabaseTransport(legacyBackend, room.id, 'uid-host')

    await transport.saveRoom(room)
    const game = buildInitialGame([room.seats[0].playerId], mulberry32(4), 1_000)
    const { publicGame, secrets } = splitSnapshot(game, room)
    await transport.saveSnapshot({ seq: 1, game: publicGame, secrets, room })

    const roomWrites = calls.filter(({ fn }) => fn === 'write_room')
    const snapshotWrites = calls.filter(({ fn }) => fn === 'write_snapshot')
    // Escada 0008 → 0007 → 0006 → 0005: o primeiro degrau carrega o board_id (055).
    expect(roomWrites).toHaveLength(4)
    expect(snapshotWrites).toHaveLength(4)
    expect(roomWrites[0].args).toHaveProperty('board_id', 'atlas')
    expect(roomWrites[0].args).toHaveProperty('match_history', [])
    expect(roomWrites[1].args).not.toHaveProperty('board_id')
    expect(roomWrites[1].args).toHaveProperty('match_history', [])
    expect(roomWrites[2].args).not.toHaveProperty('match_history')
    expect(roomWrites[2].args).toHaveProperty('match_generation', 0)
    expect(roomWrites[3].args).not.toHaveProperty('match_generation')
    expect(snapshotWrites[0].args).toHaveProperty('board_id', 'atlas')
    expect(snapshotWrites[0].args).toHaveProperty('match_history', [])
    expect(snapshotWrites[1].args).not.toHaveProperty('board_id')
    expect(snapshotWrites[1].args).toHaveProperty('match_history', [])
    expect(snapshotWrites[2].args).not.toHaveProperty('match_history')
    expect(snapshotWrites[2].args).toHaveProperty('match_generation', 0)
    expect(snapshotWrites[3].args).not.toHaveProperty('match_generation')
    expect(fake.rows.get('rooms:sala-legada')).toMatchObject({
      status: 'lobby',
      matchGeneration: 0,
      seq: 1,
    })
  })

  it('recua de 0007 para 0006 depois que a geração avançou, sem perder a partida', async () => {
    const fake = fakeSupabase()
    const current = fake.client('uid-host')
    const calls: Record<string, unknown>[] = []
    const legacyBackend: SupabaseLike = {
      channel: current.channel.bind(current),
      from: current.from.bind(current),
      rpc(fn, args) {
        if (fn === 'write_room' && Object.hasOwn(args, 'match_history')) {
          calls.push(args)
          return Promise.resolve({
            data: null,
            error: { code: 'PGRST202', message: 'Could not find the function public.write_room' },
          })
        }
        if (fn === 'write_room') calls.push(args)
        return current.rpc(fn, args)
      },
    }
    const room = {
      ...createRoom('sala-nova', {
        uid: 'uid-host',
        name: 'Ana',
        color: SEAT_COLORS[0],
        reentryCode: 'ANAAAA',
      }),
      matchGeneration: 1,
    }
    const transport = supabaseTransport(legacyBackend, room.id, 'uid-host')

    await expect(transport.saveRoom(room)).resolves.toBeUndefined()
    expect(calls).toHaveLength(3)
    expect(calls[0]).toHaveProperty('board_id')
    expect(calls[0]).toHaveProperty('match_history')
    expect(calls[1]).not.toHaveProperty('board_id')
    expect(calls[1]).toHaveProperty('match_history')
    expect(calls[2]).not.toHaveProperty('match_history')
    expect(calls[2]).toHaveProperty('match_generation', 1)
    expect(fake.rows.get('rooms:sala-nova')).toMatchObject({ matchGeneration: 1 })
  })
})
