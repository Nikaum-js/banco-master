// A porta de entrada fica deliberadamente leve: a home decide a próxima rota sem importar
// Supabase, lobby ou partida. O módulo pesado é carregado por intenção e preserva a navegação
// client-side existente — nenhum botão volta a recarregar o documento.
import { lazy, startTransition, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { importWithReload } from '@/app/lazyImportRecovery'
import { parseRoomLink } from '@/net/session'
import { HomeScreen } from './HomeScreen'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'
import { coerceBoardId } from '@/lib/mapCatalog'

type SessionModule = typeof import('./OnlineSessionGate')
let sessionModule: Promise<{ default: SessionModule['OnlineSessionGate'] }> | null = null

function loadSessionGate(): Promise<{ default: SessionModule['OnlineSessionGate'] }> {
  sessionModule ??= importWithReload(() =>
    import('./OnlineSessionGate').then((module) => ({ default: module.OnlineSessionGate })),
  )
  return sessionModule
}

const OnlineSessionGate = lazy(loadSessionGate)

function preloadSessionGate(): void {
  void loadSessionGate()
}

function SessionLoading() {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-900 p-6">
      <p role="status" className="label text-brass">Preparando a mesa…</p>
    </div>
  )
}

export function OnlineGate({ children }: { children: ReactNode }) {
  const [link, setLink] = useState(() => parseRoomLink(window.location.search))
  const [local, setLocal] = useState(() => {
    const query = new URLSearchParams(window.location.search)
    return query.has('local') || query.has('players')
  })

  const navigateEntry = useCallback((search: string) => {
    if (search) preloadSessionGate()
    window.history.pushState(null, '', `${window.location.pathname}${search}`)
    startTransition(() => {
      setLocal(false)
      setLink(parseRoomLink(search))
    })
  }, [])

  const enterLocal = useCallback(() => {
    preloadSessionGate()
    startTransition(() => setLocal(true))
  }, [])

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('map')
    if (selected) useBoardTheme.getState().setTheme(coerceBoardId(selected))
  }, [local, link])

  useEffect(() => {
    const syncRoute = () => {
      const search = window.location.search
      const query = new URLSearchParams(search)
      if (query.has('local') || query.has('players') || query.has('room') || query.has('host')) {
        preloadSessionGate()
      }
      startTransition(() => {
        setLocal(query.has('local') || query.has('players'))
        setLink(parseRoomLink(search))
      })
    }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  if (!local && !link.roomId && !link.createHost) {
    return (
      <HomeScreen
        onCreate={() => {
          const map = useBoardTheme.getState().theme
          navigateEntry(map === 'atlas' ? '?host=1' : `?host=1&map=${map}`)
        }}
        onJoin={(roomId) => navigateEntry(`?room=${encodeURIComponent(roomId)}`)}
        onLocal={enterLocal}
        onSessionIntent={preloadSessionGate}
      />
    )
  }

  return (
    <Suspense fallback={<SessionLoading />}>
      <OnlineSessionGate
        local={local}
        roomId={link.roomId}
        onExit={() => navigateEntry('')}
      >
        {children}
      </OnlineSessionGate>
    </Suspense>
  )
}
