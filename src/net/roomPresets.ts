import {
  selectOpeningMode,
  type OpeningMode,
  type Room,
} from './room'

export type RoomPresetId = OpeningMode

export interface RoomPreset {
  id: RoomPresetId
  label: string
  detail: string
  settings: {
    openingMode: OpeningMode
  }
}

export const ROOM_PRESETS = [
  {
    id: 'sealed-bid',
    label: 'Leilão secreto',
    detail: 'Lances definem a ordem e abastecem a Loteria.',
    settings: { openingMode: 'sealed-bid' },
  },
  {
    id: 'dice-roll',
    label: 'Maior dado',
    detail: 'Cada jogador rola dois dados, um por vez e sem custo.',
    settings: { openingMode: 'dice-roll' },
  },
] as const satisfies readonly RoomPreset[]

const DEFAULT_ROOM_PRESET = ROOM_PRESETS[0]
const ROOM_PRESET_STORAGE_KEY = 'bm.room-preset'

export function presetForOpeningMode(mode: OpeningMode | undefined): RoomPreset {
  return ROOM_PRESETS.find((preset) => preset.settings.openingMode === mode)
    ?? DEFAULT_ROOM_PRESET
}

export function applyRoomPreset(
  room: Room,
  preset: RoomPreset,
): ReturnType<typeof selectOpeningMode> {
  return selectOpeningMode(room, preset.settings.openingMode)
}

function browserStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export function recallRoomPreset(storage: Storage | undefined = browserStorage()): RoomPreset {
  try {
    return presetForOpeningMode(storage?.getItem(ROOM_PRESET_STORAGE_KEY) as OpeningMode | undefined)
  } catch {
    return DEFAULT_ROOM_PRESET
  }
}

export function rememberRoomPreset(
  id: RoomPresetId,
  storage: Storage | undefined = browserStorage(),
): void {
  try {
    storage?.setItem(ROOM_PRESET_STORAGE_KEY, presetForOpeningMode(id).id)
  } catch {
    // Storage bloqueado não muda o estado autoritativo da sala.
  }
}
