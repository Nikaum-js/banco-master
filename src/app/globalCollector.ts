// Coletor de último recurso (spec 042, FR-019, US5). Metade das exceções não passa por
// fronteira de React nenhuma — handler de evento, timer, callback de canal, promessa
// rejeitada. `window.onerror`/`onunhandledrejection` é o único lugar que ainda os vê.
// Registra com o mesmo tratamento das exceções contidas (FR-016) — nunca some, mas também
// não tenta mostrar tela: o coletor global não sabe em que componente estava.
import { registerFailure } from './failureRegistry'

export function installGlobalFailureCollector(): () => void {
  const onError = (event: ErrorEvent): void => {
    registerFailure({ where: 'window.error', error: event.error ?? event.message })
  }
  const onRejection = (event: PromiseRejectionEvent): void => {
    registerFailure({ where: 'window.unhandledrejection', error: event.reason })
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
