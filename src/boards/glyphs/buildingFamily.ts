// AS CONSTRUÇÕES DE UM MAPA, POR PAPEL (D-070).
//
// Arquivo próprio, e não mais um export solto no `badges.tsx`: aquele arquivo só exporta
// componentes, e o Fast Refresh do Vite exige isso (regra `react-refresh/only-export-
// components`). Aqui não há JSX — só o registro de qual glifo cumpre qual papel em cada
// mapa, o que também deixa a escolha testável sem montar React.
//
// Quem consome pede `unit`/`big`/`top`/`depot` em vez de importar `HouseBadgeIcon`, e por
// isso deixa de ficar preso à casa do Atlas quando o mapa é a Fuligem.
import {
  PlotBadgeIcon,
  HouseBadgeIcon,
  HotelBadgeIcon,
  SkyscraperBadgeIcon,
  HangarBadgeIcon,
  WorkshopBadgeIcon,
  FactoryBadgeIcon,
  IronTowerBadgeIcon,
  FreightDepotBadgeIcon,
} from './badges'

type BadgeComponent = (props: { size?: number }) => React.ReactElement

export interface BuildingFamily {
  /** Terreno sem construção. */
  plot: BadgeComponent
  /** Níveis 1–4 (casa · oficina). */
  unit: BadgeComponent
  /** Níveis 5–6 (hotel/2º hotel · fábrica/Complexo de Fábricas). */
  big: BadgeComponent
  /** Nível 7 (arranha-céu · Torre de Ferro). */
  top: BadgeComponent
  /** Melhoria de aeroporto/ferrovia (Hangar · Estação de Carga). */
  depot: BadgeComponent
}

const ATLAS_BUILDINGS: BuildingFamily = {
  plot: PlotBadgeIcon,
  unit: HouseBadgeIcon,
  big: HotelBadgeIcon,
  top: SkyscraperBadgeIcon,
  depot: HangarBadgeIcon,
}

const FULIGEM_BUILDINGS: BuildingFamily = {
  plot: PlotBadgeIcon, // terreno é geometria neutra: serve aos dois mapas
  unit: WorkshopBadgeIcon,
  big: FactoryBadgeIcon,
  top: IronTowerBadgeIcon,
  depot: FreightDepotBadgeIcon,
}

export function buildingFamily(map: 'atlas' | 'fuligem'): BuildingFamily {
  return map === 'fuligem' ? FULIGEM_BUILDINGS : ATLAS_BUILDINGS
}
