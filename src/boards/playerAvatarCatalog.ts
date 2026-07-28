export const AVATARS = [
  { id: 'classic-alive', label: 'Clássico Vivo' },
  { id: 'orbital-eyes', label: 'Olhos Orbitais' },
  { id: 'single-line', label: 'Linha Única' },
  { id: 'prism-face', label: 'Prisma' },
  { id: 'totem-face', label: 'Totem' },
] as const

export type AvatarId = (typeof AVATARS)[number]['id']

export const DEFAULT_AVATAR: AvatarId = 'classic-alive'

const AVATAR_IDS = new Set<string>(AVATARS.map((avatar) => avatar.id))

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && AVATAR_IDS.has(value)
}

export function normalizeAvatar(value: unknown): AvatarId {
  return isAvatarId(value) ? value : DEFAULT_AVATAR
}

export function avatarLabel(id: AvatarId): string {
  return AVATARS.find((avatar) => avatar.id === id)?.label ?? AVATARS[0].label
}
