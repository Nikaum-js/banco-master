export interface ReloadMarkerStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface ReloadOptions {
  release: string
  store: ReloadMarkerStore
  reload(): void
}

const RELOAD_MARKER_KEY = 'bm:lazy-import-reload'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isLazyImportFetchFailure(error: unknown): boolean {
  const message = messageOf(error)
  return (
    message.includes('Failed to fetch dynamically imported module')
    || message.includes('error loading dynamically imported module')
    || message.includes('Importing a module script failed')
  )
}

function browserOptions(): ReloadOptions | null {
  try {
    return {
      release: import.meta.env.VITE_COMMIT_SHA || 'unknown-release',
      store: window.sessionStorage,
      reload: () => window.location.reload(),
    }
  } catch {
    return null
  }
}

/**
 * Um alias de produção pode trocar de deployment enquanto uma sala continua aberta. Nesse
 * caso, o bundle antigo ainda conhece o hash de um chunk que já não existe no alias novo.
 * Um reload completo preserva o link da sala e obtém o mapa de chunks atual; o marcador por
 * release impede loop quando o deployment em si está quebrado.
 */
export async function importWithReload<T>(
  importer: () => Promise<T>,
  options: ReloadOptions | null = browserOptions(),
): Promise<T> {
  try {
    return await importer()
  } catch (error) {
    if (!options || !isLazyImportFetchFailure(error)) throw error
    const marker = `${options.release}|${messageOf(error)}`
    try {
      if (options.store.getItem(RELOAD_MARKER_KEY) === marker) throw error
      options.store.setItem(RELOAD_MARKER_KEY, marker)
    } catch (storageError) {
      if (storageError === error) throw error
      throw error
    }
    options.reload()
    return new Promise<T>(() => {})
  }
}
