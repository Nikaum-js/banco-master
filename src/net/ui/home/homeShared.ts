// Miolo comum aos dois visuais da entrada: o que a home faz é sempre a mesma coisa —
// lembrar o nome, criar sala e entrar por convite — e só a pele muda. Este arquivo evita
// repetir clipboard, extração de id de sala e persistência de nome.
import { useState } from 'react'
import type { BoardTheme } from '@/game/ui/theme/boardTheme'
import { BOARD, GROUPS, type PropertySquare } from '@/lib/boardData'
import { extractRoomId, rememberPlayerName, recallPlayerName, NAME_MAX } from '@/net/session'
import type { PublicDirectoryState } from '@/net/publicRoomDirectory'

// Injetado pelo `vite.config.ts` a partir do sha do commit publicado (Vercel/Actions).
export const COMMIT_SHA = (import.meta.env.VITE_COMMIT_SHA as string | undefined) ?? ''

export const MAX_PLAYERS = 8

export const STATS = {
  squares: BOARD.length,
  countries: Object.keys(GROUPS).length,
  players: MAX_PLAYERS,
  busTickets: BOARD.filter((square) => square.kind === 'bus-ticket').length,
}

export type HomeMapFactKind = 'squares' | 'countries' | 'bus-ticket'

export interface HomeMapFact {
  kind: HomeMapFactKind
  value: number
  label: string
}

interface HomeMapDefinition {
  name: string
  playable: boolean
  facts: readonly HomeMapFact[]
}

export const HOME_MAPS = {
  atlas: {
    name: 'Cidades do Mundo',
    playable: true,
    facts: [
      { kind: 'squares', value: STATS.squares, label: 'casas' },
      { kind: 'countries', value: STATS.countries, label: 'países' },
      { kind: 'bus-ticket', value: STATS.busTickets, label: 'Bus Ticket' },
    ],
  },
  neon: {
    name: 'Metrópole Neon',
    playable: false,
    facts: [],
  },
} as const satisfies Record<BoardTheme, HomeMapDefinition>

// A frase da home. Diz o que o jogo É e que não cobra nada, em três negativas curtas —
// é o que responde "por que eu clicaria?" antes de qualquer botão. Cada estilo pode
// falar com a própria voz (a tela neon grita, a de feltro conta caso), mas o FATO
// (multiplayer, banco imobiliário, de graça, sem instalar) é o mesmo em todas.
export const TAGLINE = 'Compre cidades, negocie propriedades e domine o tabuleiro com seus amigos.'
export { NAME_MAX }

export interface HomeActions {
  onCreate: () => void
  onJoin: (roomId: string) => void
  onJoinPublic?: (listingId: string) => void
  onLocal: () => void
}

export interface HomePublicDirectory {
  state: PublicDirectoryState
  available: boolean
  refresh: () => void
}

/** Cidades do tabuleiro de verdade — letreiro, ticker e mapa da home saem daqui. */
export const CITIES = BOARD.filter((s): s is PropertySquare => s.kind === 'property').map((s) => ({
  name: s.name,
  short: (s.short ?? s.name).toUpperCase(),
  group: s.group,
  country: GROUPS[s.group].name,
  price: s.price,
}))

export function useHomeForm({ onCreate, onJoin, onJoinPublic, onLocal }: HomeActions) {
  const [name, setName] = useState(() => recallPlayerName())
  const [joinOpen, setJoinOpen] = useState(false)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [link, setLink] = useState('')
  const [pasteFailed, setPasteFailed] = useState(false)
  const roomId = extractRoomId(link)
  // Número do portão / mesa: sorteado uma vez por visita, só ornamento.
  const [gate] = useState(() => String(1 + Math.floor(Math.random() * 24)).padStart(2, '0'))

  // O nome é opcional aqui — quem pular vai preenchê-lo no passo de identidade, que é
  // onde ele é de fato exigido. O que a home faz é só adiantá-lo.
  function go(action: () => void): void {
    rememberPlayerName(name)
    action()
  }

  // Atalho de quem recebeu o convite por fora (WhatsApp, Discord): colar sem sair do
  // teclado. A API de área de transferência pode ser negada ou nem existir — nesse caso
  // o botão se cala e o campo continua aceitando o Ctrl+V de sempre.
  async function pasteLink(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setLink(text.trim())
      else setPasteFailed(true)
    } catch {
      setPasteFailed(true)
    }
  }

  return {
    name,
    setName: (v: string) => setName(v.slice(0, NAME_MAX)),
    joinOpen,
    toggleJoin: () => setJoinOpen((v) => !v),
    directoryOpen,
    toggleDirectory: () => setDirectoryOpen((v) => !v),
    link,
    setLink,
    roomId,
    pasteFailed,
    pasteLink,
    gate,
    create: () => go(onCreate),
    local: () => go(onLocal),
    join: () => roomId && go(() => onJoin(roomId)),
    joinPublic: (listingId: string) => onJoinPublic && go(() => onJoinPublic(listingId)),
  }
}

export type HomeForm = ReturnType<typeof useHomeForm>
