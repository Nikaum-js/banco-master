// Camada acessória (spec 042, D-035, FR-004). Log central e som são acessórios — ninguém
// precisa deles pra rolar o dado, comprar ou aceitar uma troca. A queda de um não pode levar
// o tabuleiro/modais/controles junto: o fallback é só uma linha no lugar do componente,
// nunca tela cheia — e a ausência é ANUNCIADA (edge case "espaço não fica silenciosamente
// vazio"), nunca um buraco mudo que alguém possa confundir com "nenhum evento aconteceu".
import { Component, type ReactNode } from 'react'
import { registerFailure } from './failureRegistry'

interface AccessoryBoundaryProps {
  label: string
  children: ReactNode
}

interface AccessoryBoundaryState {
  broken: boolean
}

export class AccessoryErrorBoundary extends Component<AccessoryBoundaryProps, AccessoryBoundaryState> {
  state: AccessoryBoundaryState = { broken: false }

  static getDerivedStateFromError(): Partial<AccessoryBoundaryState> {
    return { broken: true }
  }

  componentDidCatch(error: unknown): void {
    registerFailure({ where: `accessory:${this.props.label}`, error })
  }

  render(): ReactNode {
    if (this.state.broken) {
      return <p className="label text-cream-muted/85 px-2 py-1">{this.props.label} indisponível</p>
    }
    return this.props.children
  }
}
