// O VEÍCULO DO BILHETE, POR MAPA (D-069) — fonte única.
//
// Existe porque o ícone de ônibus estava cravado em QUATRO lugares (compositor de negociação ×3,
// botão do HUD e o seletor de destino), e usar o Bilhete de Trem na Fuligem abria uma tela cheia
// de ônibus. Cada correção pontual deixava os outros três para trás; com um componente só, o mapa
// decide uma vez — e trocar o desenho é uma linha, como esta revisão provou.
//
// AS TRÊS TENTATIVAS, e por que a terceira é a certa:
//
//   `TrainFront` — vista frontal. É o pictograma de METRÔ (o logo do metrô de São Paulo é isso),
//                  século errado para uma cidade de 1870 a vapor.
//   `TramFront`  — bonde. Mesmo erro de época, e ainda mais urbano-moderno.
//   locomotiva desenhada à mão — tentei chaminé + caldeira + cabine + rodas em `currentColor`,
//                  buscando o vapor. A 14–18px seis marcas viram borrão: o desenho tinha mais
//                  informação do que o tamanho aguenta carregar. Mesma lição dos ícones de
//                  bairro — silhueta manda mais que referente, e ícone de UI é pequeno por
//                  definição.
//   `Train`      — vista LATERAL da lucide. Silhueta reconhecível no tamanho real, e da mesma
//                  família de traço do resto da UI. É esta.
//
// Não se reusa o `TrainGlyph` do tabuleiro aqui: ele pinta em `var(--color-brass*)` fixo, e estes
// usos vivem dentro de disco dourado ou de texto em `text-gold` — precisam herdar `currentColor`,
// que é o que os ícones da lucide fazem.
import { Bus, Train } from 'lucide-react'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'

/** Locomotiva (vista lateral). Nomeada pelo papel, não pelo pacote: quem consome não deve
 *  precisar saber de onde vem o desenho para trocá-lo. */
export function SteamLocoIcon({ size = 18 }: { size?: number }) {
  return <Train size={size} />
}

/**
 * Ícone do item de bilhete no mapa ativo: locomotiva na Cidade da Fuligem, ônibus no Atlas.
 * Herda a cor de quem o envolve, então serve tanto em disco dourado quanto em texto.
 */
export function TicketVehicleIcon({ size = 18 }: { size?: number }) {
  const fuligem = useBoardTheme((s) => s.theme) === 'fuligem'
  return fuligem ? <SteamLocoIcon size={size} /> : <Bus size={size} />
}
