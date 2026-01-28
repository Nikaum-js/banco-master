# Implementation Plan: Polimento & Lançamento

**Spec**: [spec.md](./spec.md) · **Modelo de dados**: [data-model.md](./data-model.md) · **Contratos**: [contracts/](./contracts/)

**Data**: 2026-07-26 · **ADRs de origem**: [D-038](../../docs/adr/D-038-fim-de-jogo-tem-classificacao-e-resumo.md) · [D-039](../../docs/adr/D-039-acessibilidade-aa-no-caminho-de-jogo.md) · [D-040](../../docs/adr/D-040-telemetria-minima-anonima.md) · [D-041](../../docs/adr/D-041-publicacao-em-vercel-com-gate-verde.md) · **SRS**: v1.9 (§9.5, §12.2, §12.6, §12.7, §12.8)

---

## Summary

Seis frentes que se tocam pouco. Uma delas entra no motor (quatro campos), duas são apresentação, uma é infraestrutura nova de código (porta de telemetria), duas vivem fora de `src/`.

1. **Fim de jogo** — `GameState` ganha `eliminationOrder`, `round`, `startedAt` e `endedAt`; a classificação é **derivada** por função pura (`matchSummary`), nunca guardada; a tela de vitória do `GameHUD` vira um resumo.
2. **Acessibilidade** — o trap de foco, a restauração e a política de Esc entram **no `shell.tsx`**, que já é o vocabulário único de modal do projeto: um lugar, seis camadas beneficiadas. Mais `:focus-visible` global, região viva ligada ao log tipado da 040, e auditoria `axe` no Playwright.
3. **Responsividade** — `.board-stage` ganha o eixo de orientação; painéis viram gaveta em tela estreita; retrato ganha tela própria acima de tudo.
4. **Movimento** — durações e curvas viram tokens em `index.css` + um `motion.ts` único; `useReducedMotion` deixa de ser decisão de cada componente e passa a ser propriedade do vocabulário.
5. **Telemetria** — porta `Telemetry` com adaptador nulo por padrão, adaptador Supabase (tabela nova, insert-only) e Sentry para exceção, plugado no `failureRegistry` da 042.
6. **Publicação** — `vercel.json`, workflow encadeado ao CI existente, migrations aplicadas, runbook.

**A ordem é a da spec, e ela importa:** publicar (US1) entrega valor sozinho e as demais frentes chegam por cima. Mas a US2 é a única que toca o motor — ela vai **primeiro no código** e sozinha, para que qualquer regressão de suíte apareça isolada, antes de haver seis frentes abertas ao mesmo tempo.

---

## Technical Context

**Linguagem/stack**: TypeScript estrito, React 19, Zustand, Tailwind 4, `motion`, Supabase, Vitest (`node` + `jsdom` por pragma, herdado da 042), Playwright.

**Dependências novas**: `@axe-core/playwright` (auditoria de acessibilidade no E2E), `@sentry/react` (exceção em produção). Nenhuma outra — a telemetria de produto usa o `supabase-js` que já existe.

**Onde o trabalho acontece**:

- Motor: `src/game/turn/types.ts`, `src/game/setup.ts`, `src/game/turn/turnMachine.ts`, `src/game/falencia/falencia.ts` — quatro campos e três pontos de escrita. Mais `src/game/summary.ts` (novo, puro).
- Apresentação: `src/game/ui/**`, `src/boards/**`, `src/index.css`.
- Telemetria: `src/telemetry/**` (novo).
- Fora de `src/`: `.github/workflows/**`, `vercel.json`, `supabase/migrations/0003_telemetry_events.sql`, `e2e/**`, `docs/RUNBOOK.md`.

**Fora do caminho**: nenhum reducer muda de resultado; nenhuma regra de aluguel, carta, construção, leilão ou falência é tocada. A fronteira de erro da 042 não é alterada — ela ganha um ouvinte.

**Restrição de determinismo**: `startedAt` e o instante de fim entram por injeção (`ctx.now`, o mesmo padrão que os prazos de leilão já usam) — nada de `Date.now()` dentro de reducer. `crypto.randomUUID`/`crypto.subtle` só na camada de telemetria, que não é motor.

**Compatibilidade de snapshot**: os quatro campos são aditivos, com valor seguro no carregamento — o mesmo ponto onde `normalizeLog` já normaliza (`game/log.ts:22`, chamado por `supabaseTransport.loadSnapshot`).

---

## Constitution Check

| Princípio | Conformidade |
|---|---|
| **I. SRS é verdade absoluta** | §9.5, §12.2, §12.6, §12.7, §12.8 bumpados para v1.9 **antes** deste plano, cada um apoiado em ADR (D-038 a D-041). |
| **II. Discovery antes de código** | Quatro ADRs escritas antes da spec; as quatro ambiguidades bloqueantes (plataforma, destino de telemetria, alvo de a11y, alvo responsivo) foram resolvidas com o usuário antes de qualquer linha. |
| **III. Tesouro precisa impactar** | Não aplicável — nenhuma carta é tocada. |
| **IV. Catch-up é discreto** | Preservado: a classificação final não rotula ninguém como "ajudado"; ela mostra posição, patrimônio e rodada, nada sobre mecânica de catch-up. |
| **V. Sem cooperação obrigatória** | Não aplicável. |
| **VI. Privacidade de cartas** | Reforçado: telemetria e monitoramento de erro proíbem mão, token e código de reentrada (FR-035, FR-039). O resumo de fim de jogo **não** revela mão de ninguém — mostra patrimônio e propriedades, que já são públicos (§12.3). |
| **VII. Resiliência de sessão** | Preservado: campos novos são serializáveis e entram no snapshot; telemetria não pode pausar, bloquear nem virar causa de pausa (FR-037). |

---

## Project Structure

### Documentation (this feature)

```
specs/044-polimento-lancamento/
├── spec.md
├── plan.md                        ← este arquivo
├── data-model.md                  ← campos novos do GameState, MatchSummary, tabela de telemetria
├── contracts/
│   ├── match-summary.md           ← contrato da função pura de classificação
│   ├── telemetry-port.md          ← porta Telemetry + esquema dos eventos
│   └── production-runbook.md      ← lançamento e retorno, passo a passo verificável
└── tasks.md
```

### Source Code (repository root)

```
src/game/
├── turn/types.ts                  ~ GameState: + eliminationOrder: string[], + round: number, + startedAt: number, + endedAt: number | null
├── setup.ts                       ~ createSeedState(ids, now = 0) / buildInitialGame(ids, rng, now = 0) — parâmetro OPCIONAL (50+ testes chamam sem ele)
├── turn/turnMachine.ts            ~ advanceSeat: incrementa `round` ao dar a volta na ordem de assentos
├── falencia/falencia.ts           ~ bankrupt: `s.eliminationOrder.push(debtor.id)` junto de `debtor.eliminated = true`; checkEndGame grava `endedAt`
├── log.ts                         ~ normalizeGame(snapshot): default seguro dos 4 campos ao carregar (ao lado de normalizeLog)
├── summary.ts                     + matchSummary(game): MatchSummary — PURA, derivada; nenhum rank guardado
└── cards/effects.ts               ~ netWorth exportado para summary.ts (já é export; só passa a ter segundo consumidor)

src/game/ui/
├── shell.tsx                      ~ Overlay/ModalShell ganham foco inicial, trap, restauração e política de Esc (`dismissible`)
├── EndGameScreen.tsx              + resumo de fim de jogo (substitui o ramo `winner` do GameHUD)
├── GameHUD.tsx                    ~ ramo `winner` passa a renderizar <EndGameScreen/>
├── a11y/LiveRegion.tsx            + região viva educada alimentada pelo log tipado (040) + canal assertivo ("sua vez")
├── motion.ts                      + vocabulário único: durações, curvas, variantes; freio de movimento reduzido embutido
└── OrientationGate.tsx            + tela de "gire o aparelho" (retrato), acima da árvore de jogo, sem desmontar a sessão

src/telemetry/                     (novo — porta isolada, como net/transport.ts)
├── port.ts                        + interface Telemetry + tipos de evento + adaptador nulo (default)
├── supabaseSink.ts                + insert-only na tabela nova; falha engolida (FR-037)
├── sentry.ts                      + init condicional a VITE_SENTRY_DSN; ouvinte do failureRegistry da 042
├── matchKey.ts                    + identificador derivado do id de sala (hash truncado, irreversível)
└── index.ts                       + resolução por ambiente: sem env → nulo; dev → nulo

src/app/failureRegistry.ts         ~ ganha ouvinte (a 042 registra; aqui o registro também sai para o Sentry)
src/index.css                      ~ tokens de movimento; :focus-visible global; orientação; gaveta dos painéis; alvos ≥24px
src/App.tsx                        ~ <OrientationGate/> em volta; <LiveRegion/> ao lado das camadas existentes

supabase/migrations/0003_telemetry_events.sql   + tabela insert-only com RLS (sem select)

.github/workflows/
├── ci.yml                         ~ + job a11y (axe), + job de partida completa sobre o build
└── deploy.yml                     + workflow_run encadeado ao CI: verde em main → promove produção

vercel.json                        + fallback de SPA + cache (index sem cache, assets imutáveis)
docs/RUNBOOK.md                    + lançamento, migrations, verificação e retorno

e2e/
├── fullMatch.spec.ts              + partida completa até `ended` + verificação da classificação
├── a11y.spec.ts                   + axe no caminho de jogo, inclusive telas com partida em curso
└── script.ts                      ~ hook de cenário semeado (fim de partida) + helper de navegação por teclado

tests/game/summary.test.ts         + classificação, ordem, patrimônio, duração, snapshot antigo
tests/ui/a11y/modalFocus.test.tsx  + trap, restauração e política de Esc (jsdom, padrão da 042)
tests/telemetry/*.test.ts          + porta, ausência de PII, irreversibilidade do identificador, falha silenciosa
```

---

## Decisões de design

### D1 — `round` incrementa em `advanceSeat`, e a definição é "volta na ordem", não "turno"

`advanceSeat` (`turn/turnMachine.ts:109`) já percorre `turnOrder` pulando eliminados. A rodada avança quando o próximo assento escolhido é **menor ou igual** ao anterior em posição de `turnOrder` — isto é, quando a busca deu a volta. É a única definição estável quando jogadores são eliminados no meio: contar "N turnos = 1 rodada" com N variável produziria rodadas de tamanho diferente ao longo da partida e um número que ninguém consegue conferir olhando a mesa.

O incremento fica no mesmo ponto onde a vez passa — não em `startTurn` (que também roda no início da partida, e contaria uma rodada a mais) e não no `finishIfEnded` (que nem sempre passa a vez: dívida em voo retorna antes, `turnMachine.ts:127`).

### D2 — `eliminationOrder` no estado, `rank` derivado

O único fato registrado é a **ordem em que as falências foram processadas**: `s.eliminationOrder.push(debtor.id)` na mesma linha em que `debtor.eliminated = true` (`falencia/falencia.ts:111`), antes de `checkEndGame`. Uma linha, um ponto, dentro da função que já é a autoridade da eliminação.

A posição final **não** é guardada. `matchSummary(game)` deriva: o não-eliminado é 1º; os eliminados são a `eliminationOrder` invertida. Guardar `rank` criaria dois lugares onde a mesma verdade pode divergir — e um deles seria escrito por um reducer que hoje não existe.

Consequência do edge case "todos falem no mesmo evento": o motor processa falência uma de cada vez (`bankrupt` é chamada por devedor), então a ordem existe e é determinística. Ela é a mesma em todas as telas porque vem do snapshot difundido, não do relógio de ninguém.

### D3 — `startedAt` entra por parâmetro opcional, não por `Date.now()` dentro do setup

`createSeedState` é chamada por **mais de 50 arquivos de teste**. Mudar a assinatura para exigir o relógio quebraria a suíte inteira por uma razão cosmética. O parâmetro entra opcional com default `0`:

```ts
export function createSeedState(playerIds: string[], startedAt = 0): GameState
export function buildInitialGame(playerIds: string[], rng: RNG, startedAt = 0): GameState
```

`store.ts:22` passa `Date.now()`; `host.ts:214` passa o `now` do contexto do host (o mesmo relógio que grava prazos pelo `recorder`, garantindo que cliente e host convirjam). Testes seguem com `0`, e o resumo de uma partida de teste mostra duração zero — que é exatamente o que uma partida sem relógio deve mostrar.

O instante de **fim** é o quarto campo (FR-003), e pela mesma razão: usar o relógio da tela no momento em que a partida termina daria uma duração diferente para cada cliente, e o SC-004 (mesma classificação em toda tela) cairia por um detalhe. `endedAt` é escrito em `checkEndGame`, a partir do `ctx.now` que `bankrupt` já tem em mãos (`falencia.ts:42` roda dentro dela) — o mesmo relógio que o `recorder` da 037 grava e replica.

### D4 — O trap de foco entra no `shell.tsx`, não em cada modal

`Overlay` e `ModalShell` (`game/ui/shell.tsx`) já são o vocabulário único de modal, usado por `ModalLayer`, `TradeLayer`, `HandCardLayer`, `LandAuctionLayer`, `NoticeLayer` e pelo `GameHUD`. É o mesmo ponto de alavanca que o comentário no topo do arquivo já reivindica ("divergência de backdrop/raio/gradiente é bug").

`Overlay` ganha:

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` apontando para o título do `ModalHeader`;
- foco inicial no primeiro elemento focável (ou no próprio cartão quando não houver);
- trap: `Tab`/`Shift+Tab` circulam dentro do cartão;
- restauração: guarda `document.activeElement` na montagem e devolve o foco a ele no desmonte;
- `dismissible: boolean` (default **`false`**) — Esc e clique no backdrop só fecham quando `true`.

A política de Esc da D-039 vira, então, **um booleano por camada** em vez de convenção espalhada: `NoticeLayer` e popovers informativos passam `dismissible`, `ModalLayer`/`TradeLayer`/`LandAuctionLayer`/`HandCardLayer` não passam. Modal novo nasce fechado a Esc por padrão — o default é o lado seguro.

### D5 — A região viva reusa a frase do log tipado (040), não inventa texto

`describeLogEntry` (`game/ui/log/describeLog.ts`) já converte fato tipado em frase pt-BR, e é o que a UI mostra. A `LiveRegion` educada renderiza a **última** entrada do log por essa mesma função: uma fonte, duas apresentações. Texto próprio para leitor de tela seria uma segunda narrativa a manter em sincronia — e a 040 existe justamente para acabar com isso.

O canal assertivo é separado e curto: início do meu turno, prazo prestes a vencer, comando recusado. Ele não repete o log.

Cuidado herdado da 042: `describeLogEntry` **lança por exaustividade** em `kind` desconhecido. A `LiveRegion` fica dentro de uma `AccessoryErrorBoundary` (a fronteira acessória já existe, `app/AccessoryErrorBoundary.tsx`) — anúncio é acessório, não pode derrubar a mesa.

### D6 — Retrato é uma tela acima da árvore, não um layout alternativo

`OrientationGate` envolve a árvore de jogo em `App.tsx` e, em retrato abaixo do limiar, renderiza a tela de aviso **por cima**, sem desmontar o que está embaixo. É a diferença entre "girar preserva a sessão" e "girar remonta a sala": desmontar `OnlineGate` dispararia o `dispose()` da sessão e a mesa registraria uma saída (a mesma armadilha que a 042 documentou em D1 do plan dela).

Implementação: `matchMedia('(orientation: portrait)')` + largura, via CSS (`display` alternado) sempre que possível — sem estado React no caminho crítico. A tela de aviso segue as regras de acessibilidade (foco, contraste, nome), porque ela **é** uma tela do caminho de jogo.

### D7 — Vocabulário de movimento: tokens em CSS + `motion.ts`, freio embutido

Dois consumidores diferentes precisam do mesmo valor: CSS (transições e keyframes) e `motion` (variantes JS). Então a fonte é dupla por necessidade, mas **derivada de uma tabela só**: `--motion-fast: 120ms`, `--motion-base: 200ms`, `--motion-slow: 420ms`, `--ease-standard`, `--ease-emphasis` em `index.css`; `src/game/ui/motion.ts` exporta os mesmos números e as variantes prontas (`fade`, `pop`, `slideUp`).

O freio deixa de ser decisão de componente: `motion.ts` exporta `useMotion()`, que já consulta `useReducedMotion` e devolve variantes com duração zero quando o usuário pediu menos movimento. Componente novo que use o vocabulário ganha o freio de graça; hoje são 7 pontos que lembraram e o resto que não.

No CSS, o mesmo com `@media (prefers-reduced-motion: reduce) { --motion-fast: 0ms; … }` — um bloco, e toda transição que usa token para de se mover.

**O que o freio não faz**: apagar o fato. O confete some, a contagem do dado some, mas o resultado do dado, o novo dono da propriedade e o novo saldo continuam na tela — porque são estado renderizado, não animação.

### D8 — Telemetria é porta com adaptador nulo, e o `matchKey` é hash, não id

`src/telemetry/port.ts` define `Telemetry { track(event: TelemetryEvent): void }` e o `nullTelemetry` que não faz nada. `index.ts` resolve por ambiente: sem `VITE_SUPABASE_URL`/sem `VITE_TELEMETRY=1`, ou em `import.meta.env.DEV`, devolve o nulo. É o mesmo desenho da porta `Transport` (D-020) e pelo mesmo motivo: nada abaixo pode saber que telemetria existe.

`matchKey(roomId)` = `SHA-256(roomId + salt público de build)` truncado em 16 hex. Irreversível na prática para um id de sala de alta entropia, e suficiente para correlacionar. O salt de build evita que a mesma sala correlacione entre versões, o que ninguém precisa. **Nunca** enviar `roomId` — ele é a credencial (D-019/D-036).

Ponto de emissão: `net/roomSession.ts` (sala criada, partida iniciada, pausa) e `game/summary.ts` consumido pelo `EndGameScreen`? **Não** — emitir da tela significa emitir uma vez por cliente, e oito clientes viram oito "partida finalizada". Emissão de eventos de partida é responsabilidade **do host**, em `net/host.ts`, onde já existe autoridade única. É a mesma razão pela qual o snapshot é escrito por um só.

Sentry: `sentry.ts` inicia só com `VITE_SENTRY_DSN` presente, com `beforeSend` que **remove** qualquer campo fora da lista permitida (identificador de ocorrência, mensagem, pilha, versão) — lista de permissão, não de bloqueio; lista de bloqueio erra na primeira spec que adicionar campo.

### D9 — Auditoria de acessibilidade precisa de partida em curso, então mora no Playwright

`axe` só encontra o que está renderizado. Metade das violações que importam está em modal de decisão — que só existe com uma partida rodando e uma casa comprável embaixo do peão. Por isso a auditoria não é um teste de unidade: `e2e/a11y.spec.ts` usa o roteiro determinístico que a 036 já construiu (`e2e/script.ts`) para levar a interface até cada tela do caminho de jogo e roda `@axe-core/playwright` em cada parada.

Falha o job em violação `serious` ou `critical`. `moderate`/`minor` são relatados sem quebrar — senão o gate vira negociação e alguém o desliga.

### D10 — "Partida completa" no gate é partida semeada, e isso é honesto

Levar 8 jogadores à falência por rolagem real leva muito além do teto de um gate (o lote seedado de 30 partidas do motor já é o job mais lento do CI). O roteiro de UI usa um hook de teste — `?scenario=endgame` — que semeia um estado **legal** perto do fim (dois jogadores, um deles com uma casa e caixa curto), e conduz pela interface real até a falência e a tela de classificação.

Isso não altera regra nenhuma: é o mesmo tipo de andaime que `?players=N` já é desde a 036, e o estado semeado passa pelos mesmos reducers. O que o gate prova é o **caminho**: última falência → fim de jogo → classificação correta na tela. A prova de que partidas inteiras não quebram continua sendo do `sim:batch`, que já roda 30 delas por PR no motor.

O `log()` do gate diz explicitamente que o roteiro é semeado — um gate que promete mais do que exercita é pior que gate nenhum.

### D11 — O deploy é disparado pelo resultado do CI, não pelo push

`deploy.yml` usa `workflow_run` com `workflows: [CI]`, `types: [completed]`, `branches: [main]`, e sai cedo se `conclusion != success`. Constrói com `vercel build --prod` e publica com `vercel deploy --prebuilt --prod`, usando `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` como segredos.

Previews de PR ficam com a integração nativa da Vercel (que publica no push do branch) — preview quebrado é justamente o que se quer poder ver na revisão.

`vercel.json`: `rewrites` mandando tudo para `/index.html` (SPA), `Cache-Control: no-cache` para `/index.html` e `max-age=31536000, immutable` para `/assets/*` (hash no nome, garantido pelo Vite). Sem isso, um deploy novo continua servindo o `index.html` velho, que aponta para bundles que não existem mais — tela branca em produção com todos os gates verdes.

`VITE_COMMIT_SHA` entra no build (`vercel.json` não injeta; o workflow passa) e aparece no rodapé da home e no contexto do Sentry (FR-048).

### D12 — Migrations não entram no deploy

Aplicar migration como passo do deploy é como se lança um banco quebrado às três da manhã: o deploy roda a cada merge, a migration é irreversível, e a ordem entre elas e o código nunca é a mesma nos dois sentidos (uma coluna nova precisa vir **antes** do código; uma coluna removida, **depois**).

Migration é passo do **runbook** (`contracts/production-runbook.md`), aplicado deliberadamente com `supabase db push`, com verificação explícita depois (a tabela existe, o gatilho existe, um insert de teste é rejeitado pelo select). As três migrations do projeto — as duas pendentes da 037/041 e a nova de telemetria — entram no mesmo lançamento, nessa ordem.

---

## Fluxo de implementação

1. **Fim de jogo, motor primeiro** (US2): os quatro campos + `matchSummary` + normalização de snapshot antigo, com a suíte inteira verde antes de tocar em qualquer tela. É a única frente que pode regredir o que já funciona.
2. **Fim de jogo, tela** (US2): `EndGameScreen` substituindo o ramo `winner`.
3. **Vocabulário de movimento** (US5): tokens + `motion.ts` + freio. Vem antes da acessibilidade porque o `shell.tsx` vai ser tocado nas duas frentes, e mexer duas vezes no mesmo arquivo em ordem inversa custa conflito.
4. **Acessibilidade** (US3): `shell.tsx` (trap/Esc/restauração), `:focus-visible` global, `LiveRegion`, nomes acessíveis, contraste, alvos.
5. **Responsividade** (US4): orientação, gaveta dos painéis, modais que rolam por dentro.
6. **Telemetria** (US6): porta + adaptadores + emissão no host + Sentry ligado ao `failureRegistry`.
7. **Provas** (US7): `fullMatch.spec.ts`, `a11y.spec.ts`, hook de cenário semeado, jobs novos no `ci.yml`.
8. **Publicação** (US1): `vercel.json`, `deploy.yml`, envs, runbook, migrations aplicadas, lançamento verificado.

> A ordem de **valor** é a da spec (US1 primeiro); a ordem de **execução** é esta. Publicar antes de existir gate de partida completa e de acessibilidade publicaria sem as travas que a própria D-041 exige — a US1 termina o trabalho porque ela depende do que as outras entregam.
