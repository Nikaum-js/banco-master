// Registro da sessão ativa (spec 042, T002). Sem estado React — só o módulo em si.
import { afterEach, describe, expect, it } from 'vitest'
import { getActiveSession, setActiveSession } from '@/net/activeSession'
import type { RoomSession } from '@/net/roomSession'

afterEach(() => setActiveSession(null))

describe('activeSession', () => {
  it('começa null', () => {
    expect(getActiveSession()).toBeNull()
  })

  it('setActiveSession sobrescreve o valor corrente', () => {
    const fake = {} as RoomSession
    setActiveSession(fake)
    expect(getActiveSession()).toBe(fake)

    const outro = {} as RoomSession
    setActiveSession(outro)
    expect(getActiveSession()).toBe(outro)
  })

  it('setActiveSession(null) limpa', () => {
    setActiveSession({} as RoomSession)
    setActiveSession(null)
    expect(getActiveSession()).toBeNull()
  })
})
