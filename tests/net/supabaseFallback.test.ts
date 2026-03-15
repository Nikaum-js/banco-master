import { describe, expect, it } from 'vitest'
import { buildInitialGame } from '@/game/setup'
import { splitSnapshot } from '@/net/perspective'
import { createRoom, SEAT_COLORS } from '@/net/room'
import { supabaseTransport, type SupabaseLike } from '@/net/supabaseTransport'
import { fakeSupabase } from './fakeSupabase'
import { mulberry32 } from '../sim/engine/rng'

describe('supabaseTransport — janela de deploy da revanche', () => {
  it('recua para as RPCs da migration 0005 somente na geração inicial', async () => {
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
    expect(roomWrites).toHaveLength(2)
    expect(snapshotWrites).toHaveLength(2)
    expect(roomWrites[0].args).toHaveProperty('match_generation', 0)
    expect(roomWrites[1].args).not.toHaveProperty('match_generation')
    expect(snapshotWrites[0].args).toHaveProperty('match_generation', 0)
    expect(snapshotWrites[1].args).not.toHaveProperty('match_generation')
    expect(fake.rows.get('rooms:sala-legada')).toMatchObject({
      status: 'lobby',
      matchGeneration: 0,
      seq: 1,
    })
  })

  it('não recua para a assinatura antiga depois que a geração avançou', async () => {
    const fake = fakeSupabase()
    const current = fake.client('uid-host')
    const calls: Record<string, unknown>[] = []
    const legacyBackend: SupabaseLike = {
      channel: current.channel.bind(current),
      from: current.from.bind(current),
      rpc(fn, args) {
        if (fn === 'write_room') {
          calls.push(args)
          return Promise.resolve({
            data: null,
            error: { code: 'PGRST202', message: 'Could not find the function public.write_room' },
          })
        }
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

    await expect(transport.saveRoom(room)).rejects.toMatchObject({ code: 'PGRST202' })
    expect(calls).toHaveLength(1)
  })
})
