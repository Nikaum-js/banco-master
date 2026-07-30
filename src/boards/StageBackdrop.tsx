// Cenário do palco do tabuleiro — a MESMA cidade da home, vista da mesa de jogo.
// A tela de entrada estabelece o mundo (skyline, rotas aéreas, tráfego); ao
// entrar na partida esse mundo sumia e sobrava um vazio chapado ao redor da
// mesa. Aqui a cidade continua existindo atrás do tabuleiro: o skyline respira
// no rodapé e as aeronaves cruzam o céu POR TRÁS da mesa — continuidade, não
// concorrência.
//
// Disciplina de palco: tudo mais lento e mais apagado que na home, porque o
// foco é a partida. As rotas voam em ~2× a duração da entrada e o skyline fica
// atenuado via CSS (.stage-backdrop__city). Movimento reduzido e o layout
// empilhado (<=1100px) já são tratados pelas classes `entry-*` e pelo bloco
// `.stage-backdrop` do index.css.
import { useEffect } from 'react'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'
import { play } from '@/game/ui/sound/engine'
import { AtlasCityscape } from '@/net/ui/home/AtlasCityscape'
import { FuligemBackdrop } from '@/net/ui/home/FuligemBackdrop'
import { AirlinerMark } from '@/net/ui/entryShell'

// Rotas próprias do palco: mais altas (céu acima dos painéis), mais lentas e
// mais discretas que as da home. O tabuleiro é opaco — a aeronave some atrás
// da mesa e reaparece do outro lado, o que vende a profundidade de graça.
const STAGE_ROUTES = [
  {
    d: 'M-170 168C240 84 560 190 920 118S1240 46 1610 108',
    duration: '104s',
    delay: '-42s',
    rest: '38%',
    scale: 0.68,
    opacity: 0.38,
    facing: 1,
  },
  {
    d: 'M1580 320C1220 372 900 262 610 316S220 396 -150 330',
    duration: '138s',
    delay: '-67s',
    rest: '56%',
    scale: 0.5,
    opacity: 0.26,
    facing: -1,
  },
] as const

function StageRoutes({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {STAGE_ROUTES.map((route, index) => (
        <g key={route.d}>
          <path
            d={route.d}
            stroke="currentColor"
            strokeWidth={index === 0 ? 1.5 : 1.1}
            strokeDasharray={index === 0 ? '3 11' : '2 13'}
            strokeLinecap="round"
            opacity={index === 0 ? 0.16 : 0.11}
          />
          <g
            className="entry-flyer entry-aircraft"
            opacity={route.opacity}
            style={{
              offsetPath: `path('${route.d}')`,
              // Mesma regra da home: rota indo pra esquerda mantém o avião
              // nivelado — a rotação automática o viraria de cabeça pra baixo.
              offsetRotate: route.facing === 1 ? 'auto' : '0deg',
              offsetDistance: route.rest,
              animationDuration: route.duration,
              animationDelay: route.delay,
            }}
          >
            <AirlinerMark scale={route.scale} facing={route.facing} />
          </g>
        </g>
      ))}
    </svg>
  )
}

// Cada mapa tem seu palco de partida (055/D-069). O da Fuligem é a MESMA cidade da
// home/lobby, atenuada e estática: quase toda a cena fica escondida pela mesa, então
// duplicar dezenas de timelines não acrescenta informação. As janelas do complexo
// principal continuam acesas nas cores dos assentos.
export function StageBackdrop() {
  const theme = useBoardTheme((state) => state.theme)
  // Sirene breve na abertura dos portões (055/US3): toca UMA vez, quando o palco da
  // partida monta no mapa Fuligem. Cue sem asset (Atlas) é no-op por contrato do engine.
  useEffect(() => {
    if (theme === 'fuligem') play('match-start')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem do palco
  }, [])
  if (theme === 'fuligem') {
    return (
      <div className="stage-backdrop" aria-hidden="true">
        <FuligemBackdrop className="fuligem-backdrop--stage" staticScene />
      </div>
    )
  }
  return (
    <div className="stage-backdrop" aria-hidden="true">
      <StageRoutes className="absolute inset-0 h-full w-full text-brass" />
      <div className="stage-backdrop__city">
        <AtlasCityscape className="absolute inset-0 h-full w-full text-brass" />
      </div>
    </div>
  )
}
