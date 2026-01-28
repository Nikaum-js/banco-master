# Contrato — porta `Telemetry`

**Spec**: [../spec.md](../spec.md) · **Modelo**: [../data-model.md](../data-model.md) · **ADR**: [D-040](../../../docs/adr/D-040-telemetria-minima-anonima.md)

Arquivo: `src/telemetry/port.ts`. Mesmo desenho da porta `Transport` (D-020): uma interface, adaptadores atrás dela, **adaptador nulo por padrão**.

---

## Porta

```ts
export interface Telemetry {
  /** Dispara e esquece. NUNCA lança, NUNCA retorna promessa que alguém precise aguardar. */
  track(event: TelemetryEvent): void
}

export const nullTelemetry: Telemetry = { track: () => {} }
```

## Eventos (união fechada — não existe campo livre)

```ts
export type TelemetryEvent =
  | { kind: 'room_created'; matchKey: string }
  | { kind: 'match_started'; matchKey: string; players: number }
  | { kind: 'match_ended'; matchKey: string; players: number; rounds: number; durationMs: number | null }
  | { kind: 'match_paused'; matchKey: string; cause: 'disconnect' | 'persistence' }
```

**Não existe `payload: unknown`, `meta`, `extra` nem `props`.** A união fechada é o mecanismo: um campo livre é onde, seis meses depois, alguém coloca o nome do jogador "só para depurar". O que a D-040 proíbe, o tipo impede.

## Invariantes (verificadas por teste)

| # | Invariante |
|---|---|
| T1 | `track` nunca lança — falha de rede, destino fora do ar, resposta 4xx: tudo engolido (FR-037) |
| T2 | `track` nunca bloqueia o chamador nem entra em fila de retentativa |
| T3 | Nenhum evento contém nome, mão, token de sessão, código de reentrada ou id de sala em claro (FR-035) |
| T4 | `matchKey` é derivado por hash e não permite recuperar o `roomId` (FR-036) |
| T5 | Sem ambiente configurado, `resolveTelemetry()` devolve `nullTelemetry` e **nenhuma requisição sai** (FR-038) |
| T6 | Em `import.meta.env.DEV`, sempre `nullTelemetry` |
| T7 | Cada fato gera **um** evento — a emissão é do host, não de cada cliente |

## Quem emite, e de onde

| Evento | Emissor | Momento |
|---|---|---|
| `room_created` | `net/roomSession.ts` (lado host) | sala criada |
| `match_started` | `net/host.ts` | partida iniciada (o mesmo ponto que constrói o `GameState`) |
| `match_ended` | `net/host.ts` | ao aplicar o comando que levou `phase` a `'ended'` |
| `match_paused` | `net/host.ts` | ao entrar uma causa de pausa (§11.3/§11.4) |

**Emitir do host, nunca da tela.** Oito clientes renderizando o fim de jogo emitiriam oito `match_ended`. A autoridade já é única (D-020) — a contagem segue a autoridade.

## `matchKey`

```ts
export async function matchKey(roomId: string): Promise<string>
```

`SHA-256(roomId + BUILD_SALT)` via `crypto.subtle`, truncado em 16 hex. `BUILD_SALT` é público (vai no bundle) — ele não protege segredo nenhum; ele só evita que a mesma sala correlacione entre versões, o que ninguém precisa.

A proteção real é o hash: o `roomId` é a credencial de acesso (D-019/D-036) e **não pode** aparecer num destino que não é tratado como sensível.

## Exceções — Sentry

`src/telemetry/sentry.ts`. Fora da porta `Telemetry` de propósito: o contrato é outro (assíncrono, com pilha, com agrupamento).

- Inicia **apenas** com `VITE_SENTRY_DSN` presente; ausente = nenhum código de monitoramento roda.
- Assina o `failureRegistry` da 042 — ele continua sendo a única fonte de ocorrência, e o `occurrenceId` que o jogador lê na tela é o mesmo que chega ao monitoramento (FR-039).
- `beforeSend` aplica **lista de permissão** de campos: `occurrenceId`, `where`, `phase`, `seq`, `message`, `version`. Tudo o mais é descartado antes do envio. Lista de bloqueio erraria na primeira spec que acrescentasse um campo.
- `sendDefaultPii: false`, sem captura de entrada do usuário, sem replay de sessão.

## Testes obrigatórios (`tests/telemetry/`)

1. `resolveTelemetry()` sem env → `nullTelemetry`; nenhuma chamada de rede é feita (adaptador espião).
2. `track` com o adaptador Supabase falhando (rejeita) → não lança, não repete, não afeta o chamador.
3. Serialização de cada variante de evento não contém nenhuma das strings sentinela (nome, token, código, roomId) injetadas de propósito no contexto.
4. `matchKey` é estável para o mesmo `roomId` e diferente para outro; o resultado não contém o `roomId` como substring.
5. `beforeSend` do Sentry descarta campo fora da lista de permissão (objeto com chave `hand` some).
