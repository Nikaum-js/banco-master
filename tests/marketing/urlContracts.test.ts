// Contratos de URL da 051: a raiz virou landing e o app mora em `/play`, mas nenhum
// convite antigo pode quebrar. Aqui ficam os três lados do contrato — o link novo que o
// app gera, a leitura de link colado, e a configuração de borda que traduz o link velho.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRoomId, roomLink } from '@/net/session'

describe('roomLink (FR-005)', () => {
  it('gera convite novo apontando para /play', () => {
    expect(roomLink('abc123')).toBe('/play?room=abc123')
    expect(roomLink('abc123', 'https://exemplo.test')).toBe('https://exemplo.test/play?room=abc123')
  })

  it('escapa o id na query', () => {
    expect(roomLink('a b&c')).toBe('/play?room=a%20b%26c')
  })
})

describe('extractRoomId aceita convite colado inteiro', () => {
  it('lê o formato novo (/play?room=)', () => {
    expect(extractRoomId('https://exemplo.test/play?room=xyz789')).toBe('xyz789')
  })

  it('continua lendo o formato antigo (/?room=)', () => {
    expect(extractRoomId('https://exemplo.test/?room=xyz789')).toBe('xyz789')
  })

  it('continua lendo o código cru', () => {
    expect(extractRoomId('xyz789')).toBe('xyz789')
  })
})

describe('vercel.json traduz os contratos antigos na borda (FR-004)', () => {
  const config = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf-8'),
  ) as {
    redirects?: { source: string; destination: string; permanent?: boolean; has?: { type: string; key: string }[] }[]
    rewrites?: { source: string; destination: string }[]
  }

  // Todo param que significava "estou indo pro jogo" quando aparecia na raiz.
  it.each(['room', 'host', 'local', 'players'])('redireciona /?%s= para /play', (param) => {
    const redirect = config.redirects?.find(
      (r) => r.source === '/' && r.has?.some((h) => h.type === 'query' && h.key === param),
    )
    expect(redirect, `redirect de /?${param}= ausente`).toBeDefined()
    expect(redirect?.destination).toBe('/play')
    // Temporário (307): um 308 cacheado pra sempre no browser impediria de revisitar a decisão.
    expect(redirect?.permanent).toBe(false)
  })

  it.each([
    ['/play', '/play.html'],
    ['/how-to-play', '/how-to-play.html'],
    ['/faq', '/faq.html'],
  ])('serve a rota limpa %s a partir de %s', (route, file) => {
    expect(config.rewrites).toContainEqual({ source: route, destination: file })
  })

  it('não tem mais o catch-all que engolia toda rota para o index', () => {
    expect(config.rewrites?.some((r) => r.destination === '/index.html')).toBe(false)
  })
})
