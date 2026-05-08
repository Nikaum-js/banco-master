// Abas da gaveta de retrato (D-079). Vive fora do `PortraitDock.tsx` porque os ids são
// compartilhados por três lados — o `tablist` que os controla, os dois `aside` que eles
// rotulam (`aria-controls`/`aria-labelledby` precisam casar) e o `Board01Classic`, que
// decide qual está aberta. Constante exportada de um arquivo de componente também quebra o
// fast refresh, e essa é a razão mecânica de o módulo existir separado.
export type DockTab = 'players' | 'actions'

export type DockTabSpec = {
  id: DockTab
  label: string
  /** id do `aside` que a aba abre — vira `aria-controls` na aba e `id` no painel. */
  panelId: string
  /** id da própria aba — vira `aria-labelledby` no painel. */
  tabId: string
}

export const DOCK_TABS: readonly DockTabSpec[] = [
  { id: 'players', label: 'Jogadores', panelId: 'dock-panel-players', tabId: 'dock-tab-players' },
  { id: 'actions', label: 'Ações', panelId: 'dock-panel-actions', tabId: 'dock-tab-actions' },
]
