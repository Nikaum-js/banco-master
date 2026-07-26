// Liga o `useGameStore` (Zustand, consumido pela UI) ao `client` multiplayer (spec 037, T017).
//
// Em single-player o store aplica o comando localmente. Ao entrar numa sala,
// `connectMultiplayer` troca o destino do `dispatch`: o mesmo `GameAction` que ia para o
// reducer local passa a ser EMITIDO para o host (pessimista, sem aplicar local), e o
// estado só reflete quando o comando aceito volta pela difusão. A UI não muda.
//
// Card 1 do review de arquitetura (2026-07-25): este arquivo era 34 linhas de mapeamento
// à mão de método-do-store → `GameAction`, mantidas em lockstep com `store.ts` e
// `commands.ts` sem nenhuma checagem do compilador. Um método novo esquecido aqui fazia a
// UI jogar LOCALMENTE no meio de uma partida online, em silêncio. Com uma porta só, não
// há mais tabela para esquecer.
import { useGameStore } from '@/game/store'
import { useRoomStore } from './roomStore'
import type { GameAction, PlayerAction } from '@/game/commands'
import type { Client } from './client'

const SYSTEM_KINDS = new Set<GameAction['kind']>(['close-auction', 'close-land-lots', 'close-land-auction', 'pause', 'resume'])

// Conecta o store ao client. Retorna um desligador que RESTAURA o dispatch local — sair
// da sala não pode deixar o store apontando para o `send` de um cliente morto.
export function connectMultiplayer(client: Client): () => void {
  // Espelha o `game` no store do jogo e a SALA no store de sala (spec 038): identidade e
  // perspectiva vivem separadas do `GameState`, que segue sem PII (D-019).
  const sync = (): void => {
    const g = client.game()
    if (g) useGameStore.setState({ game: g })
    useRoomStore.setState({ room: client.room(), myUid: client.uid, connection: client.connection() })
  }
  const unsub = client.subscribe(sync)
  sync()

  const localDispatch = useGameStore.getState().dispatch
  useGameStore.setState({
    dispatch: (action) => {
      // Ações de SISTEMA (fecho de leilão por prazo, pausa/retomada) são do host: ele as
      // emite pelo próprio `tick()`/presença e as difunde. Vindas daqui, no-op — antes
      // isso era escrito como três entradas `() => {}` na tabela de 34 mapeamentos.
      if (SYSTEM_KINDS.has(action.kind)) return
      client.send(action as PlayerAction)
    },
  })

  return () => {
    unsub()
    useGameStore.setState({ dispatch: localDispatch }) // volta a aplicar local
    useRoomStore.getState().reset() // sair da sala volta a UI ao modo local
  }
}
