// ESTADOS VISÍVEIS DA PARTIDA (058) — efeitos ativos, empréstimos e imunidades.
//
// As três superfícies que a jogatina apontou como ilegíveis, reunidas aqui porque têm a
// MESMA forma: um resumo compacto que cabe na coluna estreita da gaveta de retrato, e um
// detalhe sob demanda que abre por toque, clique ou teclado. Nenhuma delas pode depender de
// `title` nem de hover — num celular não existe ponteiro, e foi num celular que a partida
// aconteceu.
//
// A REGRA NÃO MORA AQUI. Tudo é projeção de `loansView`, `immunitiesOf` e `effectsView`,
// que são puros e testáveis em node. Este arquivo só decide pintura e foco.
import { useState, type ReactNode } from 'react'
import { useGameStore } from '@/game/store'
import { useRoomStore, useLocalView } from '@/net/roomStore'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { Button, Chip, EmptyState, SectionHeader } from '@/game/ui/primitives'
import { PlayerFace } from '@/boards/PlayerFace'
import { CoinIcon } from '@/game/ui/icons'
import { money } from '@/lib/money'
import { cn } from '@/lib/utils'
import { activeBoard } from '@/game/ui/theme/boardTheme'
import { loansView, type LoanRow } from './loansView'
import { immunitiesOf, immunityDurationLabel, type ImmunityRow } from './immunityView'
import { effectsView, lapsLabel, type EffectRow } from './effectsView'

// ---------------------------------------------------------------------------------------
// Casca comum dos detalhes. `dismissible` liga Esc e clique no backdrop, e o `Overlay` já
// implementa foco inicial, trap de Tab e devolução do foco a quem abriu (§12.6). Estes
// modais são INFORMATIVOS — não decidem a partida —, então Esc fechá-los é o correto.
// ---------------------------------------------------------------------------------------
function DetailModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Overlay z={64} dismissible onClick={onClose}>
      <ModalShell className="state-detail">
        <ModalHeader center title={title} />
        <div className="state-detail__body">{children}</div>
        <div className="state-detail__foot">
          <Button variant="secondary" onClick={onClose} className="w-full">Fechar</Button>
        </div>
      </ModalShell>
    </Overlay>
  )
}

// ---------------------------------------------------------------------------------------
// EFEITOS ATIVOS (§12.3) — agora com alvo, alcance e duração.
// ---------------------------------------------------------------------------------------
const SCOPE_LABEL: Record<EffectRow['scope'], string> = {
  mesa: 'Mesa inteira',
  jogador: 'Um jogador',
  propriedade: 'Uma propriedade',
}

export function ActiveEffectsSection() {
  const effects = useGameStore((s) => s.game.tempEffects)
  const room = useRoomStore((s) => s.room)
  const rows = effectsView(effects, room)

  return (
    <div className="side-panel-section">
      <SectionHeader
        title="Efeitos ativos"
        meta={rows.length > 0 ? <Chip tone="neutral">{rows.length}</Chip> : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<CalmMark />} title="Tabuleiro em paz" />
      ) : (
        <ul className="effect-list">
          {rows.map((e) => (
            <li key={e.key} className={cn('effect-row', e.tone === 'gold' && 'effect-row--gold')}>
              <span className="effect-row__tag" aria-hidden>{e.tag}</span>
              <div className="effect-row__copy">
                <p className="effect-row__label">{e.label}</p>
                {/* A consequência JÁ vem com o nome do afetado e o da propriedade
                    resolvidos — era exatamente isso que faltava ("Alvo sem construir"). */}
                <p className="effect-row__consequence">{e.consequence}</p>
                <p className="effect-row__meta">
                  <span className="effect-row__scope">{SCOPE_LABEL[e.scope]}</span>
                  <span aria-hidden>·</span>
                  <span>resta{e.lapsRemaining === 1 ? '' : 'm'} {lapsLabel(e.lapsRemaining)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CalmMark() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 13c1.2 1.4 2.5 2 4 2s2.8-.6 4-2" strokeLinecap="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------------------
// EMPRÉSTIMOS (§15) — TODOS, o tempo todo.
//
// O painel anterior lia `loans.find(debtorId === jogadorDaVez)`: uma dívida entre dois
// adversários sumia da tela até chegar a vez do devedor. O prazo restante é informação
// pública (§15.6) e a existência da dívida nunca dependeu de quem está jogando.
// ---------------------------------------------------------------------------------------
export function LoansSection() {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const local = useLocalView()
  const [open, setOpen] = useState(false)
  const view = loansView(game, room, local.seatId)

  if (view.count === 0) return null

  const urgente = view.mostUrgent!
  return (
    <div className="side-panel-section loan-panel-section">
      <SectionHeader
        title={view.count === 1 ? 'Empréstimo ativo' : 'Empréstimos ativos'}
        meta={<Chip tone="alert">{view.count}</Chip>}
      />
      {/* Resumo mínimo: quem deve a quem, e o prazo mais próximo. Tudo o mais fica no
          detalhe — a coluna da gaveta de retrato mede ~136px, e o que não couber aqui
          desaparece de verdade, não "encolhe". */}
      <button
        type="button"
        className="loan-summary hit-44"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Ver detalhes de ${view.count === 1 ? 'o empréstimo ativo' : `${view.count} empréstimos ativos`}`}
      >
        <span className="loan-summary__pair">
          <PlayerFace color={urgente.debtor.color} avatar={urgente.debtor.avatar} skin={urgente.debtor.skin} size={20} />
          <span className="loan-summary__arrow" aria-hidden>→</span>
          <PlayerFace color={urgente.creditor.color} avatar={urgente.creditor.avatar} skin={urgente.creditor.skin} size={20} />
        </span>
        <span className="loan-summary__copy">
          <span className="loan-summary__who">{urgente.debtor.name} deve a {urgente.creditor.name}</span>
          <span className="loan-summary__term">
            {urgente.lapsLeft === 1 ? 'vence no próximo GO' : `vence em ${lapsLabel(urgente.lapsLeft)}`}
            {view.count > 1 && ` · +${view.count - 1} ${view.count === 2 ? 'outro' : 'outros'}`}
          </span>
        </span>
      </button>

      {open && (
        <DetailModal title={view.count === 1 ? 'Empréstimo ativo' : 'Empréstimos ativos'} onClose={() => setOpen(false)}>
          <ul className="loan-detail-list">
            {view.rows.map((row) => (
              <li key={`${row.debtorId}-${row.creditorId}`}>
                <LoanDetail row={row} />
              </li>
            ))}
          </ul>
        </DetailModal>
      )}
    </div>
  )
}

function LoanDetail({ row }: { row: LoanRow }) {
  const dispatch = useGameStore((s) => s.dispatch)
  const cash = useGameStore((s) => s.game.players.find((p) => p.id === row.debtorId)?.cash ?? 0)
  const local = useLocalView()
  // A AUTORIZAÇÃO é a mesma tabela que o host usa para descartar comando ilegítimo — não
  // uma segunda regra escrita na UI. Quem não é o devedor local vê somente leitura, e não
  // um botão desabilitado: um botão cinza mentiria sobre haver ação ali.
  const mayPay = row.iAmDebtor && local.mayActAction({ kind: 'pay-off-loan' })
  const canPay = cash >= row.payoff

  return (
    <div className="loan-detail">
      <div className="loan-detail__head">
        <PlayerFace color={row.debtor.color} avatar={row.debtor.avatar} skin={row.debtor.skin} size={26} />
        <p className="loan-detail__relation">
          <strong>{row.debtor.name}</strong> deve a <strong>{row.creditor.name}</strong>
        </p>
        <Chip tone="alert">{row.ratePct}% no GO</Chip>
      </div>

      <dl className="loan-detail__facts">
        <div><dt>Principal fixo</dt><dd className="currency">{money(row.principal)}</dd></div>
        <div><dt>Cobrança por GO</dt><dd className="currency text-logo">− {money(row.interest)}</dd></div>
        <div><dt>Voltas restantes</dt><dd>{lapsLabel(row.lapsLeft)}</dd></div>
        <div><dt>Quitação agora</dt><dd className="currency">{money(row.payoff)}</dd></div>
      </dl>

      {/* O prazo é o fato que muda a decisão: na última volta o principal sai sozinho, e
          quem não tiver caixa cai na cobrança de dívida (§15.6). */}
      <p className="loan-detail__term">
        {row.lapsLeft === 1
          ? `No próximo GO o jogo desconta ${money(row.dueTotal)} de uma vez.`
          : 'Ao vencer, o jogo desconta principal + juros de uma vez.'}
      </p>

      {mayPay ? (
        <Button
          disabled={!canPay}
          onClick={() => dispatch({ kind: 'pay-off-loan' })}
          aria-label={`Quitar ${money(row.payoff)}`}
          title={canPay ? 'Pagar o principal e encerrar o empréstimo' : 'Caixa insuficiente para o principal'}
          className="w-full mt-3"
        >
          {canPay ? `Quitar · ${money(row.payoff)}` : `Falta ${money(row.payoff - cash)} para quitar`}
        </Button>
      ) : (
        <p className="loan-detail__readonly">
          <CoinIcon size={12} aria-hidden />
          Só {row.debtor.name} pode quitar
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------
// IMUNIDADES (§8.4 e §10.6) — o escopo real, não um booleano.
//
// Botão na linha do jogador; detalhe em modal. `IMU` com `title="Imunidade ativa"` não
// dizia se a proteção valia em UMA propriedade ou em TUDO, contra quem, nem por quanto
// tempo — três coisas que mudam completamente o valor de um benefício negociável.
// ---------------------------------------------------------------------------------------
export function ImmunitySignal({ playerId, playerName }: { playerId: string; playerName: string }) {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const [open, setOpen] = useState(false)
  const immunities = immunitiesOf(game, playerId, room)

  if (immunities.count === 0) return null

  // O selo é CURTO por obrigação: ele divide a linha com o caixa, e um rótulo longo
  // ("TOTAL +2") empurrava o valor — medido em 1440×900, o chip cobria o "R$ 3.000".
  // Compacto aqui, completo no detalhe (FR-022/FR-023).
  //
  // A distinção total × por propriedade NÃO fica só na cor (§12.6): o selo preenchido
  // marca a proteção total, e o nome acessível diz a mesma coisa por extenso.
  const resumo = immunities.hasTotal
    ? `imunidade total${immunities.propertyCount > 0 ? ` e ${immunities.propertyCount} por propriedade` : ''}`
    : `${immunities.propertyCount} ${immunities.propertyCount === 1 ? 'imunidade' : 'imunidades'} de propriedade`

  return (
    <>
      <button
        type="button"
        className="player-row__signal player-row__signal--action hit-44"
        data-total={immunities.hasTotal || undefined}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${playerName}: ${resumo}. Ver detalhes`}
      >
        IMU {immunities.count}
      </button>
      {open && (
        <DetailModal title={`Imunidades de ${playerName}`} onClose={() => setOpen(false)}>
          <ul className="immunity-list">
            {immunities.rows.map((row, i) => (
              <li key={i}><ImmunityDetail row={row} /></li>
            ))}
          </ul>
        </DetailModal>
      )}
    </>
  )
}

function ImmunityDetail({ row }: { row: ImmunityRow }) {
  if (row.scope === 'total') {
    return (
      <div className="immunity-detail immunity-detail--total">
        <p className="immunity-detail__scope">Imunidade total · temporária</p>
        <p className="immunity-detail__what">
          <strong>{row.beneficiary.name}</strong> não paga aluguel nem imposto e não pode ser alvo de
          efeito negativo.
        </p>
        <p className="immunity-detail__term">{immunityDurationLabel(row.lapsRemaining)}</p>
      </div>
    )
  }

  const place = activeBoard()[row.pos]?.name ?? 'propriedade'
  return (
    <div className="immunity-detail">
      <p className="immunity-detail__scope">Imunidade de aluguel · uma propriedade</p>
      <p className="immunity-detail__what">
        <strong>{row.beneficiary.name}</strong> não paga aluguel em <strong>{place}</strong>
        {/* "Contra quem" só quando a regra registrou o vínculo. Onde não há concedente,
            a interface omite em vez de inventar uma relação. */}
        {row.granter && <> — concedida por <strong>{row.granter.name}</strong></>}.
      </p>
      <p className="immunity-detail__term">{immunityDurationLabel(row.lapsRemaining)}</p>
    </div>
  )
}
