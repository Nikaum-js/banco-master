// Identificador derivado e irreversível (044, T041 / contrato §matchKey). A ÚNICA coisa que
// protege o id de sala — a credencial de acesso (D-019/D-036) — de trafegar em claro num
// destino que ninguém trata como sensível.
//
// `BUILD_SALT` é PÚBLICO: vai no bundle, visível a quem abrir o DevTools. Ele não guarda
// segredo nenhum — só evita que a mesma sala correlacione entre versões diferentes do app,
// o que ninguém precisa. A proteção real é o hash em si (SHA-256, sem volta).
const BUILD_SALT = (import.meta.env.VITE_BUILD_SALT as string | undefined) ?? 'banco-master'

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** SHA-256(roomId + sal de build), truncado em 16 hex — correlaciona eventos da MESMA
 *  partida sem devolver caminho nenhum de volta ao `roomId` (T4 do contrato). */
export async function matchKey(roomId: string): Promise<string> {
  const bytes = new TextEncoder().encode(roomId + BUILD_SALT)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(digest).slice(0, 16)
}
