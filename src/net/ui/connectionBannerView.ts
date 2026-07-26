// VIEW-MODEL do aviso de conexão (041, FR-006/009 — D13 do plan). Dois fatos diferentes:
// *"a mesa está parada"* (todos veem, vem do `GameState` — `PauseBanner`) e *"eu não estou
// na mesa"* (só eu vejo, vem da casca de rede — este). Empilhar os dois no mesmo componente
// forçaria um a mentir: quem caiu não recebe o `GameState` que diz que a mesa está pausada.
import type { ConnectionState } from '@/net/client'

export interface ConnectionBannerView {
  readonly title: string
  readonly detail: string
}

// `null` = nada a mostrar (conectado). Sem contagem regressiva e sem ação destrutiva
// (FR-009) — não há timeout de desconexão, a espera é indefinida por princípio.
export function connectionBannerView(connection: ConnectionState): ConnectionBannerView | null {
  if (connection === 'connected') return null
  if (connection === 'reconnecting') {
    return { title: 'Você caiu da sala', detail: 'Tentando reconectar. A partida segue esperando por você.' }
  }
  // 'desynced': o canal voltou, mas a reconciliação de estado esgotou as tentativas — texto
  // próprio (data-model §4): não é "caiu", é "voltou e ainda está acertando o estado".
  return { title: 'Reconectando o estado', detail: 'A conexão voltou; ainda sincronizando a partida.' }
}
