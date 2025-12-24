/**
 * Países do tema "Cidades do Mundo" — conjunto FECHADO (dez), e os nomes em pt-BR.
 *
 * Vive num módulo `.ts` separado de `flags.tsx` porque a regra `react-refresh` exige que um
 * arquivo `.tsx` exporte apenas componentes — e estes são dados, não componentes. O nome do país
 * não vive no board (`uf` guarda só o ISO), então esta é a fonte única dele para a interface.
 */
export const FLAG_CODES = ['AE', 'BR', 'CN', 'DE', 'EG', 'ES', 'FR', 'IT', 'JP', 'US'] as const
export type FlagCode = (typeof FLAG_CODES)[number]

export function isFlagCode(code: string): code is FlagCode {
  return (FLAG_CODES as readonly string[]).includes(code.toUpperCase())
}

// Nome do país em pt-BR — o CARD 07 pede o país por extenso, e ele não vive no board
// (`uf` guarda só o ISO). Fonte única para toda a interface.
const COUNTRY_NAME: Record<FlagCode, string> = {
  AE: 'Emirados Árabes Unidos',
  BR: 'Brasil',
  CN: 'China',
  DE: 'Alemanha',
  EG: 'Egito',
  ES: 'Espanha',
  FR: 'França',
  IT: 'Itália',
  JP: 'Japão',
  US: 'Estados Unidos',
}

export function countryName(code: string): string {
  const upper = code.toUpperCase()
  return isFlagCode(upper) ? COUNTRY_NAME[upper] : upper
}
