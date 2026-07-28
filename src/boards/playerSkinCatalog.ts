export const SKINS = [
  { id: 'careca', label: 'Careca' },
  { id: 'cavanhaque', label: 'Cavanhaque' },
  { id: 'topete', label: 'Topete' },
  { id: 'cartola', label: 'Cartola' },
  { id: 'safari', label: 'Safári' },
  { id: 'aviador', label: 'Aviador' },
  { id: 'robo', label: 'Robô' },
  { id: 'astronauta', label: 'Astronauta' },
] as const

export type SkinId = (typeof SKINS)[number]['id']

export const DEFAULT_SKIN: SkinId = 'careca'

const SKIN_IDS = new Set<string>(SKINS.map((skin) => skin.id))

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && SKIN_IDS.has(value)
}

export function normalizeSkin(value: unknown): SkinId {
  return isSkinId(value) ? value : DEFAULT_SKIN
}

export function skinLabel(id: SkinId): string {
  return SKINS.find((skin) => skin.id === id)?.label ?? SKINS[0].label
}
