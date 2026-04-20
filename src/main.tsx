import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RootErrorBoundary } from './app/RootErrorBoundary.tsx'
import { installGlobalFailureCollector } from './app/globalCollector.ts'
import { initSentry } from './telemetry/sentry.ts'
import { applyMapFromUrl } from './game/ui/theme/boardTheme.ts'

initSentry() // 044/T047: sem VITE_SENTRY_DSN, isto é um no-op — nenhum código de monitoramento roda
installGlobalFailureCollector() // FR-019: handler/timer/callback/promessa rejeitada nunca ficam mudos

// O MAPA TEM DE ESTAR ESCOLHIDO ANTES DE QUALQUER ESTADO SER SEMEADO.
//
// `useGameStore` se cria no CARREGAMENTO do módulo (`store.ts`: `game: freshGame(...)`), e
// `seedTitles()` monta `titles` percorrendo o binding vivo `BOARD` naquele instante. O `?map=`
// era aplicado num `useEffect` do `OnlineGate` — e efeito roda DEPOIS do filho montar. A ordem
// real era: semeia `titles` no Atlas → troca o tabuleiro para a Fuligem → jogo com títulos de
// um mapa e casas de outro.
//
// O sintoma era crash ao COMPRAR: `priceOf(pos)` lê `BOARD` na hora do clique (Fuligem pos 4 =
// Mina de Ferro, R$220 ⇒ abre `resolution: purchase`), mas `titles[4]` não existia, porque no
// Atlas a pos 4 é imposto e imposto não é rentável. `s.titles[pos].ownerId` num `undefined`.
//
// Aqui é o único ponto que roda antes de tudo: `App` também entra por import dinâmico, depois
// desta linha. Isso importa porque o `OnlineGate` está no grafo estático de `App` e traz o store
// pela camada de rede mesmo que `GameSurface` seja lazy. A segunda defesa está no `setTheme`,
// que realinha os títulos se o tabuleiro mudar com o jogo já criado.
applyMapFromUrl()

void import('./App.tsx').then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  )
})
