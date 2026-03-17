import { useId, useMemo, useState } from 'react'
import { Dice5, Gavel, RefreshCw, Users } from 'lucide-react'
import { Button } from '@/game/ui/primitives'
import type {
  PublicDirectoryState,
  PublicOpeningMode,
  PublicRoomListing,
} from '@/net/publicRoomDirectory'
import { cn } from '@/lib/utils'

function ageLabel(minutes: number): string {
  if (minutes < 1) return 'criada agora'
  if (minutes === 1) return 'criada há cerca de 1 min'
  if (minutes < 60) return `criada há cerca de ${minutes} min`
  const hours = Math.max(1, Math.round(minutes / 60))
  return `criada há cerca de ${hours} h`
}

function ritualLabel(mode: PublicOpeningMode): string {
  return mode === 'sealed-bid' ? 'Leilão secreto' : 'Maior dado'
}

function ListingCard({
  listing,
  onJoin,
}: {
  listing: PublicRoomListing
  onJoin: (listingId: string) => void
}) {
  const RitualIcon = listing.openingMode === 'sealed-bid' ? Gavel : Dice5
  return (
    <article className="public-room-card">
      <div className="public-room-card__head">
        <div>
          <strong>{listing.label}</strong>
          <span>{ageLabel(listing.createdMinutesAgo)}</span>
        </div>
        <span className="public-room-card__vacancies">
          <Users size={15} aria-hidden />
          {listing.availableSeats} {listing.availableSeats === 1 ? 'vaga' : 'vagas'}
        </span>
      </div>
      <div className="public-room-card__ritual">
        <RitualIcon size={15} aria-hidden />
        <span>{ritualLabel(listing.openingMode)}</span>
        <small>até {listing.capacity} jogadores</small>
      </div>
      <Button
        variant="ghost"
        className="public-room-card__join"
        onClick={() => onJoin(listing.listingId)}
        aria-label={`Entrar na ${listing.label}`}
      >
        Entrar nesta mesa
      </Button>
    </article>
  )
}

export function PublicRoomDirectory({
  state,
  available,
  onRefresh,
  onJoin,
}: {
  state: PublicDirectoryState
  available: boolean
  onRefresh: () => void
  onJoin: (listingId: string) => void
}) {
  const titleId = useId()
  const [minimumSeats, setMinimumSeats] = useState(1)
  const [openingMode, setOpeningMode] = useState<'all' | PublicOpeningMode>('all')
  const visible = useMemo(
    () => state.listings.filter((listing) => (
      listing.availableSeats >= minimumSeats
      && (openingMode === 'all' || listing.openingMode === openingMode)
    )),
    [minimumSeats, openingMode, state.listings],
  )

  const firstLoad = state.phase === 'idle' || state.phase === 'loading'
  const noServerResults = state.phase === 'empty'
  const noFilterResults = state.phase === 'ready' && visible.length === 0
  const hasResults = visible.length > 0

  return (
    <section className="public-room-directory" aria-labelledby={titleId}>
      <div className="public-room-directory__head">
        <div>
          <p className="home-map-panel__eyebrow">Diretório público</p>
          <h3 id={titleId}>Mesas abertas agora</h3>
        </div>
        <button
          type="button"
          className="public-room-directory__refresh"
          onClick={onRefresh}
          disabled={!available || firstLoad}
          aria-label="Atualizar mesas públicas"
        >
          <RefreshCw size={17} aria-hidden />
        </button>
      </div>

      <p className="public-room-directory__intro">
        Lobbies publicados pelo host. A partida continua privada para quem está na mesa.
      </p>

      <div className="public-room-directory__filters" aria-label="Filtros do diretório">
        <label>
          <span>Mínimo de vagas</span>
          <select
            value={minimumSeats}
            onChange={(event) => setMinimumSeats(Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((amount) => (
              <option key={amount} value={amount}>{amount}+</option>
            ))}
          </select>
        </label>
        <label>
          <span>Ritual de Largada</span>
          <select
            value={openingMode}
            onChange={(event) => setOpeningMode(event.target.value as 'all' | PublicOpeningMode)}
          >
            <option value="all">Todos</option>
            <option value="sealed-bid">Leilão secreto</option>
            <option value="dice-roll">Maior dado</option>
          </select>
        </label>
      </div>

      <div
        className={cn('public-room-directory__status', hasResults && 'sr-only')}
        role={state.phase === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {!available && 'O diretório público está indisponível neste build. Convites privados continuam funcionando.'}
        {available && firstLoad && 'Buscando mesas públicas…'}
        {available && noServerResults && 'Nenhuma mesa pública com vagas agora.'}
        {available && noFilterResults && 'Nenhuma mesa atende a estes filtros.'}
        {available && state.phase === 'error' && (state.message ?? 'Não foi possível carregar as mesas públicas.')}
        {available && state.phase === 'rate-limited' && (state.message ?? 'Aguarde para atualizar novamente.')}
      </div>

      {hasResults && (
        <div className="public-room-directory__list" aria-label="Mesas públicas disponíveis">
          {visible.map((listing) => (
            <ListingCard key={listing.listingId} listing={listing} onJoin={onJoin} />
          ))}
        </div>
      )}

      {available && (state.phase === 'error' || state.phase === 'rate-limited') && (
        <Button variant="ghost" className="public-room-directory__retry" onClick={onRefresh}>
          Tentar atualizar
        </Button>
      )}
    </section>
  )
}
