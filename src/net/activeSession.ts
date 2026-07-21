// Registro da sessão ativa (spec 042, D2 do plan). `RootErrorBoundary` vive em `main.tsx`;
// `session` nasce dentro de `OnlineRoom`, três componentes abaixo. Prop-drilling por três
// camadas só pra alcançar o caminho de exceção não compensa — um módulo sem estado React
// resolve sem Context. `OnlineRoom` registra ao criar e limpa no cleanup de `dispose()`.
import type { RoomSession } from './roomSession'

let active: RoomSession | null = null

export function setActiveSession(session: RoomSession | null): void {
  active = session
}

export function getActiveSession(): RoomSession | null {
  return active
}
