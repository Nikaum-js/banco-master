// Loop-breaker (spec 042, FR-011/FR-024, D4 do plan). Estado de componente não sobrevive a
// reload — por isso a decisão "já tentei isto antes?" vive num `store` chave→valor injetado
// (produção: `sessionStorage`, sobrevive ao F5, morre com a aba), nunca em memória do React.
// Puro por construção: testável sem `sessionStorage` de verdade.
export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

export const sessionStorageStore: KeyValueStore = {
  get: (key) => sessionStorage.getItem(key),
  set: (key, value) => sessionStorage.setItem(key, value),
}

export type LoopCheck = 'first' | 'repeat'

export interface LoopBreaker {
  /** Primeira vez que `signature` aparece sob `key` → 'first' (e grava). A MESMA assinatura
   * de novo → 'repeat' — inclusive depois de um reload, porque `store` sobrevive a ele. Uma
   * assinatura DIFERENTE reseta: é causa nova, não a mesma repetindo. */
  check(key: string, signature: string): LoopCheck
}

export function createLoopBreaker(store: KeyValueStore = sessionStorageStore): LoopBreaker {
  return {
    check(key, signature) {
      const seen = store.get(key)
      if (seen === signature) return 'repeat'
      store.set(key, signature)
      return 'first'
    },
  }
}
