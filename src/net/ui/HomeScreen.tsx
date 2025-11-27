// Tela inicial (spec 038, US4 — FR-021). Antes desta spec, a única porta de entrada do
// multiplayer era digitar `?host=1` / `?room=<id>` na barra de endereços — inviável para
// qualquer pessoa fora do desenvolvimento.
//
// Três saídas: criar sala, entrar por link, ou jogar local (o cliente único de sempre,
// que segue existindo como andaime de demonstração).
import { useState } from 'react'
import { Button } from '@/game/ui/primitives'
import { ModalShell, ModalHeader } from '@/game/ui/shell'
import { extractRoomId } from '@/net/session'

export function HomeScreen({ onCreate, onJoin, onLocal }: { onCreate: () => void; onJoin: (roomId: string) => void; onLocal: () => void }) {
  const [link, setLink] = useState('')
  const roomId = extractRoomId(link)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-coffee-950">
      <ModalShell className="w-full max-w-md">
        <ModalHeader title="Banco Master" subtitle="Clone multiplayer de Banco Imobiliário" center />
        <div className="p-4 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Button onClick={onCreate} className="w-full py-3 text-base">
              Criar sala
            </Button>
            <p className="label text-cream-muted text-center">Você vira o anfitrião e compartilha o link</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-coffee-500" />
            <span className="label text-cream-muted/70">ou</span>
            <span className="h-px flex-1 bg-coffee-500" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="label text-gold">Entrar com o link recebido</span>
            <div className="flex gap-2">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && roomId) onJoin(roomId)
                }}
                placeholder="Cole o link ou o código da sala"
                className="flex-1 min-w-0 px-3 py-2 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500 text-cream placeholder:text-cream-muted/50 focus:border-gold/60"
              />
              <Button variant="secondary" disabled={!roomId} onClick={() => roomId && onJoin(roomId)}>
                Entrar
              </Button>
            </div>
          </div>

          <button
            type="button"
            onClick={onLocal}
            className="label text-cream-muted/70 hover:text-cream underline underline-offset-4 decoration-coffee-500 mx-auto"
          >
            Jogar local, neste dispositivo
          </button>
        </div>
      </ModalShell>
    </div>
  )
}
