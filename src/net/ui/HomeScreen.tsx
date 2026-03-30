// Tela inicial (spec 038, US4 — FR-021). Antes desta spec, a única porta de entrada do
// multiplayer era digitar `?host=1` / `?room=<id>` na barra de endereços — inviável para
// qualquer pessoa fora do desenvolvimento.
//
// Ordem da tela (revisão de UI, referência: richup.io): NOME primeiro, uma ação primária
// grande logo abaixo, e as saídas de baixo peso (entrar por link, jogar local) numa fila
// secundária. O nome perguntado aqui é lembrado (`rememberPlayerName`) e chega preenchido
// na tela de identidade — no fluxo antigo, criar uma sala pedia o nome só no passo 2, e a
// primeira coisa que a home mostrava era um botão sem nenhum contexto de quem você é.
//
// O campo de link some por padrão: quem recebe um convite clica no link, não cola. Deixá-lo
// sempre aberto dava a duas ações de peso muito diferente o mesmo tamanho na tela.
//
// Visual: letreiro de pôster de viagem sobre a "sala de mapas" (entryShell) — o wordmark
// vive FORA do painel, grande, com o filete de latão; o painel guarda só as ações.
import { useState } from 'react'
import { Button } from '@/game/ui/primitives'
import { extractRoomId, rememberPlayerName, recallPlayerName, NAME_MAX } from '@/net/session'
import { EntryPanel, EntryStage, OrnamentRule } from './entryShell'

// Injetado pelo `vite.config.ts` a partir do sha do commit publicado (Vercel/Actions).
const COMMIT_SHA = (import.meta.env.VITE_COMMIT_SHA as string | undefined) ?? ''

export function HomeScreen({ onCreate, onJoin, onLocal }: { onCreate: () => void; onJoin: (roomId: string) => void; onLocal: () => void }) {
  const [name, setName] = useState(() => recallPlayerName())
  const [joinOpen, setJoinOpen] = useState(false)
  const [link, setLink] = useState('')
  const roomId = extractRoomId(link)

  // O nome é opcional aqui — quem pular vai preenchê-lo no passo de identidade, que é
  // onde ele é de fato exigido. O que a home faz é só adiantá-lo.
  function go(action: () => void): void {
    rememberPlayerName(name)
    action()
  }

  return (
    <EntryStage>
      <header className="text-center">
        <p className="label text-brass tracking-caps text-[0.7rem]">Cidades do Mundo</p>
        <h1 className="display leading-[0.88] mt-2.5 text-[clamp(3.25rem,10vw,5.25rem)]">
          Banco <span className="text-brass">Master</span>
        </h1>
        <OrnamentRule className="mt-3 mx-auto w-64 max-w-full" />
        <p className="text-starlight-muted text-sm mt-3">Banco imobiliário multiplayer — até 8 jogadores, direto no navegador.</p>
      </header>

      <EntryPanel className="max-w-sm">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="home-name" className="label text-brass text-center">
              Seu nome
            </label>
            <input
              id="home-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') go(onCreate)
              }}
              placeholder="Ex.: Marco Polo"
              maxLength={NAME_MAX}
              autoFocus
              className="entry-input text-center"
            />
          </div>

          <Button onClick={() => go(onCreate)} className="w-full py-3.5 text-base">
            Criar sala
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              aria-expanded={joinOpen}
              // Só referencia o campo quando ele existe: `aria-controls` apontando para um id
              // ausente é violação de `aria-valid-attr-value` no axe (gate de a11y, 044).
              aria-controls={joinOpen ? 'join-room-field' : undefined}
              onClick={() => setJoinOpen((v) => !v)}
            >
              Entrar com link
            </Button>
            <Button variant="secondary" onClick={() => go(onLocal)}>
              Jogar local
            </Button>
          </div>

          {joinOpen && (
            <div id="join-room-field" className="flex flex-col gap-1.5">
              <label htmlFor="join-room" className="label text-brass">
                Link ou código recebido
              </label>
              <div className="flex gap-2">
                <input
                  id="join-room"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomId) go(() => onJoin(roomId))
                  }}
                  placeholder="Cole aqui o link da sala"
                  autoFocus
                  className="entry-input flex-1 min-w-0"
                />
                <Button disabled={!roomId} onClick={() => roomId && go(() => onJoin(roomId))}>
                  Entrar
                </Button>
              </div>
            </div>
          )}
        </div>
      </EntryPanel>

      {/* Versão publicada (044, FR-048): é o que transforma "deu erro" em um relato
          que localiza a build. Vazio em desenvolvimento — aí não há o que identificar. */}
      {COMMIT_SHA && (
        <footer className="flex flex-col items-center">
          <p className="label text-starlight-muted/70 text-[0.6rem] tracking-wider">versão {COMMIT_SHA.slice(0, 7)}</p>
        </footer>
      )}
    </EntryStage>
  )
}
