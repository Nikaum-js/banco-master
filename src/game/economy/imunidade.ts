// Imunidade de aluguel (014, SRS §8.4 / D-010) — puro. Concedida na troca (013); aqui ficam
// a consulta (isenção de aluguel) e o decremento por volta (chamado no afterPassGo do GO).
import type { GameState } from '../turn/types'

// O jogador tem imunidade ativa naquela propriedade? (isenta o aluguel — §8.4)
export function hasImmunity(state: GameState, beneficiaryId: string, pos: number): boolean {
  return state.immunities.some((i) => i.beneficiaryId === beneficiaryId && i.pos === pos)
}

// Decrementa as imunidades por N voltas do beneficiário ao passar pelo GO; remove as expiradas.
// Permanentes (lapsRemaining === null) ficam intactas. MUTA o state (clone do turno).
export function tickImmunities(state: GameState, beneficiaryId: string): void {
  state.immunities = state.immunities.filter((i) => {
    if (i.beneficiaryId !== beneficiaryId || i.lapsRemaining === null) return true // outros / permanente
    i.lapsRemaining -= 1
    return i.lapsRemaining > 0 // remove ao chegar a 0
  })
}
