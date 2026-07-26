# Implementation Plan: Fronteira de erro — a tela cai, a partida não

**Spec**: [spec.md](./spec.md) · **Contrato**: [contracts/transport-delta.md](./contracts/transport-delta.md)

**Data**: 2026-07-26 · **ADR de origem**: [D-035](../../docs/adr/D-035-falha-de-interface-nao-derruba-a-partida.md) · **SRS**: v1.8 (§11.3/§11.4)

---

## Summary

Duas fronteiras React com contratos opostos, uma tela de falha estática que nunca lê estado envenenado, um registro de ocorrência sem PII, e — pela primeira vez neste repo — um ambiente de teste que monta componente.

1. **Fronteira de jogo** — abaixo da sessão, em volta de `{children}` na fase `'playing'` de `OnlineGate`. Cai a vista, a sessão não sente nada.
2. **Camada acessória** — `CenterLog` e `SoundLayer` contidos à parte do tabuleiro/controles: um `LogKind` sem descritor não derruba a mesa.
3. **Fronteira de último recurso** — em volta de `<App/>`, em `main.tsx`. Antes de mostrar a tela de falha, encerra a presença desta sessão (mecanismo de pausa por desconexão já existente, §11.3 — nenhuma causa nova).
4. **Loop-breaker** — uma segunda falha com a mesma assinatura, mesmo depois de reload, para de oferecer remontagem automática e mostra o identificador de ocorrência.
5. **Exceções fora do render** (US5, P3) — coletor global (`error`/`unhandledrejection`) e, no caminho de autoridade do host, uma recusa por falha distinguível de recusa por regra.
6. **Prova executável** — `@testing-library/react` + `jsdom` novos, isolados por `environmentMatchGlob` sem tocar a suíte `node` existente.

---

## Correção de escopo em relação ao `spec.md`

A seção **Paralelismo** do spec diz que a feature toca `src/net/**` **num ponto só** (a exposição de encerramento de presença em `RoomSession`). As FRs da própria spec (FR-019–022, SC-008, US5) e a própria [D-035](../../docs/adr/D-035-falha-de-interface-nao-derruba-a-partida.md) ("no caminho de autoridade do host, um comando que aborta ao ser aplicado é recusado de forma visível") exigem um segundo ponto: `net/host.ts` (o `accept()` de `host.ts:83`, citado pelo próprio spec no item 5 do "Por que esta spec existe"). Há ainda um terceiro ponto, pequeno: um método de porta novo em `Transport` para o sinal de recusa por falha chegar ao remetente, e um registro mínimo (`net/activeSession.ts`) para a fronteira de último recurso achar a sessão sem prop-drilling por três componentes.

As FRs são o texto vinculante e testável; a frase de "Paralelismo" ficou desatualizada em relação à própria US5 do mesmo documento. Não é mudança de regra — é a spec corrigindo a si mesma antes do código. Fica registrado aqui em vez de reabrir o spec.md.

---

## Technical Context

**Linguagem/stack**: TypeScript estrito, React 19, Zustand, Supabase Realtime. Sem framework de teste de componente hoje — `@testing-library/react` entra como dependência nova (React 19 é peer-compatível).

**Onde o trabalho acontece**: raiz (`src/main.tsx`, `src/App.tsx`), `src/app/**` (novo — a fronteira e a tela de falha vivem aqui, fora de `game/` e `net/`, porque servem os dois), `src/game/ui/**` (fronteira de jogo e de camada acessória, porque envolvem componentes que já moram lá), e três pontos cirúrgicos em `src/net/**` (`roomSession.ts`, `host.ts`, `transport.ts` + os dois adapters).

**Fora do caminho**: nenhum reducer, nenhum campo novo em `GameState`, nenhuma correção das exceções que hoje existem (exaustividade do log é dívida da 040). A tela de falha não lê `GameState` nem `Room` — só a URL (estática) e o que a própria fronteira registrou.

**Testes**: `vitest` continua `environment: 'node'` por padrão; `environmentMatchGlob` promove só os testes de componente novos para `jsdom`. `@playwright/test` (já existe) cobre o cenário de dois browsers da US3 (FR-025), que exige presença de verdade em duas conexões — coisa que `jsdom` não simula.

**Restrição de determinismo**: geração de id de ocorrência e timestamp entram por injeção (mesmo padrão de `HostOptions.now`/`rng`) — nenhum teste depende de `Date.now()`/`Math.random()` reais.

---

## Constitution Check

| Princípio | Conformidade |
|---|---|
| **I. SRS é verdade absoluta** | §11.4 bumpado para v1.8 antes deste plano, apoiado em D-035. |
| **II. Discovery antes de código** | Spec sem ambiguidade bloqueante (clarify concluído sem perguntas); ADR registrada antes da spec. |
| **III/IV/V/VI** | Não aplicável — nenhuma regra de jogo, carta, catch-up ou privacidade de mão é tocada. |
| **VII. Resiliência de sessão** | É a extensão do princípio para a terceira causa de falha (o próprio código), sem inventar causa de pausa nova. |

---

## Project Structure

### Documentation (this feature)

```
specs/042-fronteira-de-erro-da-interface/
├── spec.md
├── plan.md                    ← este arquivo
├── contracts/
│   └── transport-delta.md     ← delta da porta Transport: rejectCommand
└── tasks.md
```

### Source Code (repository root)

```
src/app/                              (novo diretório — casca, não pertence a game/ nem net/)
├── failureRegistry.ts               + registro estruturado (kind, phase, seq, mensagem, stack) + id curto; injetável (mintId/now); nunca grava cartas/token/código
├── FailureScreen.tsx                 + tela de falha ÚNICA, por props: variant ('match'|'root'), mode ('room'|'local'), roomId, occurrenceId, canRetry, onRetry
├── MatchErrorBoundary.tsx           + fronteira de jogo — classe, componentDidCatch registra e re-renderiza FailureScreen local, loop-breaker via sessionStorage
├── RootErrorBoundary.tsx            + fronteira de último recurso — classe, componentDidCatch chama getActiveSession()?.leaveOnFatalError() ANTES de marcar erro
└── AccessoryErrorBoundary.tsx       + camada acessória — classe fininha, fallback é só uma linha ("indisponível") no lugar do componente, sem afetar irmãos

src/main.tsx                          ~ <RootErrorBoundary><App/></RootErrorBoundary>

src/net/
├── activeSession.ts                 + registro do RoomSession ativo (set/get), sem estado React — é o que RootErrorBoundary lê sem prop-drilling
├── roomSession.ts                   ~ + leaveOnFatalError() (host?.stop(); client?.leave(); dispose interno); OnlineRoom chama setActiveSession no mount/dispose
├── transport.ts                     ~ + rejectCommand(toToken, info) na porta (mesmo padrão de rejectJoin)
├── localTransport.ts                ~ implementa rejectCommand
├── supabaseTransport.ts             ~ implementa rejectCommand
├── host.ts                          ~ accept() ganha try/catch em volta de applyCommand; falha → registra, rejectCommand ao fromToken, retorna false SEM incrementar seq/broadcast
├── client.ts                        ~ ouve rejectCommand quando o senderId é o meu; expõe lastCommandFailure(): {occurrenceId, action} | null
└── ui/
    ├── OnlineGate.tsx               ~ fase 'playing' envolve {children} em <MatchErrorBoundary roomId={...}>; CommandFailureToast novo, lido de lastCommandFailure

src/game/ui/
├── log/CenterLog (dentro de shared.tsx:~1590) ~ envolvido por <AccessoryErrorBoundary label="Histórico">
└── sound/SoundLayer.tsx              ~ envolvido por <AccessoryErrorBoundary label="Som"> (o componente que lê o seletor de classify.ts)

vitest.config.ts                      ~ + test.environmentMatchGlob: [['tests/ui/**/*.test.tsx', 'jsdom']]
package.json                         + devDependencies: @testing-library/react, jsdom

tests/ui/errorBoundaries/              + component tests novos (FR-023/024)
tests/net/                             ~ conformance estendida (rejectCommand), host.test.ts (accept() com applyCommand que lança)
e2e/                                    + roteiro de dois browsers: casca cai → presença encerra → outro browser vê pausa por desconexão (FR-025)
```

---

## Decisões de design

### D1 — Onde cada fronteira fica, e por quê o React garante o contrato

A fronteira de jogo envolve **`{children}` dentro de `OnlineRoom`** (fase `'playing'`), não `OnlineRoom` inteiro. Quando ela captura um erro, React desmonta só a subárvore que quebrou — `OnlineRoom` continua montado, o `useEffect` do `setInterval(tick)` e o de `session.dispose()` no unmount **nunca disparam**, porque o componente que os declara não remonta. É assim que FR-002/FR-003 valem por construção, não por convenção: não existe caminho de código em que a fronteira de jogo alcance a conexão.

A fronteira de último recurso envolve **`<App/>` inteiro**, em `main.tsx` — acima de `OnlineGate`, cobrindo os três ramos que hoje escapam dele (HomeScreen, "Supabase não configurado", `?local=1`) e o `?sons`/`SoundBoard` de `App.tsx`. Quando ela captura, **toda** a árvore é desmontada — inclusive `OnlineRoom`, cujo efeito de `dispose()` roda, mas `dispose()` **deliberadamente não desconecta** (comentário de `roomSession.ts:246`, StrictMode). Por isso o encerramento de presença não pode depender do ciclo de vida do efeito: `componentDidCatch` chama `getActiveSession()?.leaveOnFatalError()` **antes** de marcar o estado de erro — síncrono, garantido, independente de quando o React decidir rodar os cleanups.

### D2 — `activeSession.ts`: um módulo, não um Context

`RootErrorBoundary` vive em `main.tsx`; `session` é criado dentro de `OnlineRoom`, três componentes abaixo (`App` → `OnlineGate` → `OnlineRoom`). Passar isso por prop exigiria três camadas carregando uma ref que só serve para o caminho de exceção. Um módulo com `setActiveSession`/`getActiveSession` (4 linhas, sem estado React) resolve sem prop-drilling e sem Context — o mesmo motivo por que não existe um `RoomSessionContext` no projeto hoje. `OnlineRoom` chama `setActiveSession(session)` ao criar (mesmo `useState` lazy init) e `setActiveSession(null)` no cleanup de `dispose()`.

Consequência limpa: se a queda acontece ANTES de `OnlineRoom` existir (HomeScreen, boot, `SoundBoard`), `getActiveSession()` devolve `null`, `leaveOnFatalError()` nunca é chamado — exatamente o edge case "não há presença a encerrar".

### D3 — A tela de falha não pergunta nada à sessão: ela lê a URL

FR-012 pede "reabrir pelo link e, sem assento reconhecido, o código de reentrada". A tentação é a fronteira de último recurso perguntar ao `session` (morto ou morrendo) qual fase ele estava. Isso é exatamente o que o edge case "a exceção acontece na própria tela de falha" proíbe: a tela não pode depender de nada que possa estar envenenado.

A solução mais simples é também a mais robusta: um botão "Reabrir a sala" que faz `window.location.href = roomLink(roomId, origin)` — uma navegação de verdade. Isso reentra pelo boot normal do `OnlineGate`, que **já** resolve identidade/lobby/reentrada/playing corretamente (é o mesmo caminho que qualquer F5 usa hoje). A tela de falha não precisa saber se o assento foi reconhecido; ela só precisa saber o `roomId` (lido de `parseRoomLink(window.location.search)`, estático) e se está em modo local (`?local`/`?players`, mesmo check textual de `OnlineGate.tsx:31-34`, duplicado deliberadamente — a fronteira não importa nada de `OnlineGate` para continuar funcionando se `OnlineGate` for a própria coisa que quebrou).

Modo local (FR-014): sem `roomId`, o botão é só "Recomeçar" (reload para `?local=1`), e o texto diz que a partida não pode ser recuperada — sem sugerir o contrário (item 8 da auditoria, fora de escopo, ver Assumptions do spec).

### D4 — Loop-breaker sobrevive a reload via `sessionStorage`, não via estado React

FR-011/FR-024 exigem que a MESMA falha, mesmo depois de um F5, pare de oferecer remontagem automática. Estado de componente não sobrevive a reload — por isso a assinatura da falha (uma string estável: `error.name + '|' + error.message`, nunca a stack, que pode variar por build/minificação) e uma contagem de tentativas vão para `sessionStorage` (sobrevive ao reload, morre com a aba — mesmo escopo de "registro é local" das Assumptions), sob uma chave por fronteira (`bm:boundary:match`).

Regra: primeira vez que uma assinatura aparece → mostra a tela normal, com botão de remontar (uma tentativa permitida). Se a MESMA assinatura aparecer de novo — seja porque o remontar falhou de novo, seja porque a página foi recarregada e a árvore quebrou de novo no primeiro render — a tela mostra "parou de tentar" com o identificador de ocorrência, sem botão de retry. Uma assinatura DIFERENTE (bug diferente) reseta a contagem — não é um circuit breaker permanente da fronteira, é por causa.

### D5 — `host.accept()`: falha vira recusa visível, nunca estado parcial

`accept()` (`host.ts:83`) hoje é: `applyCommand` → se `next === game`, no-op silencioso; senão, incrementa `seq`, persiste, difunde. Uma exceção dentro de `applyCommand` hoje sobe crua para o callback do transporte (US5, item 5 do spec) — o comando nunca chega a incrementar `seq` (fica no estado de antes), mas o remetente não recebe nem uma correção nem uma recusa: silêncio absoluto.

A mudança é um `try/catch` em volta só da chamada a `applyCommand`:

```ts
let next: GameState
try {
  next = applyCommand(game, action, ctx)
} catch (e) {
  const occurrenceId = registerFailure({ where: 'host.accept', phase: room.status, seq, error: e })
  if (fromToken) transport.rejectCommand(fromToken, { occurrenceId })
  return false
}
```

`fromToken` passa a fluir de `handleSubmit` até `accept` (hoje `accept` só recebe a `action`). Comandos de sistema (`tick()`, fecho de leilão) não têm `fromToken` — falha ali só é registrada, sem unicast, porque não há um remetente único a quem recusar (FR-020 fala de "comando MEU", isto é, de jogador). Estado nunca avança pela metade: `game`/`seq` só são reatribuídos DEPOIS do `try`, então uma exceção não altera nenhum dos dois (FR-021 por construção do fluxo, não por asserção extra).

`rejectCommand` é um método novo na porta `Transport` (documentado em `contracts/transport-delta.md`), espelhando `rejectJoin` que já existe — inclusive na semântica de transporte: trafega no canal compartilhado (nada sensível, só o `occurrenceId`), e é `client.ts` quem filtra pelo próprio `toToken`, não a porta. `client.ts` ganha `onCommandRejected` populando um campo local (`lastCommandFailure`), lido por um toast pequeno em `OnlineGate.tsx` (reaproveita o padrão visual do `ConnectionBanner`) — distinto de recusa por regra (que continua silenciosa, fora de escopo mudar isso agora — FR-022 só cobra DISTINGUIBILIDADE quando a recusa por falha existir, não que a por regra passe a aparecer).

### D6 — Ambiente de teste novo sem tocar o existente

`environmentMatchGlob` (a opção documentada em versões antigas do Vitest) **não existe no Vitest 4** — checado direto no `node_modules` instalado (`vitest@4.1.10`), não em memória de versões anteriores. O mecanismo real é o pragma por arquivo: a primeira linha de um `.test.tsx` novo traz `// @vitest-environment jsdom`, e só aquele arquivo sobe de ambiente. `vitest.config.ts` ganha só `include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']` (mais amplo, aditivo — os `.test.ts` existentes continuam batendo, ambiente `node` continua o default do `test.environment`). Os testes de componente novos vivem em `tests/ui/**/*.test.tsx`, com `@testing-library/react` + `jsdom`, cada um com o pragma na 1ª linha.

FR-025 (queda da casca → presença encerra → pausa por desconexão noutra tela) não é alcançável por `jsdom` (não há canal Realtime de verdade nem uma segunda aba) — vai para `e2e/` com Playwright, no mesmo padrão de dois browsers que a 037/041 já usam.

---

## Fluxo de implementação

1. `net/activeSession.ts` + `roomSession.leaveOnFatalError()` + `OnlineRoom` registrando/limpando (base de tudo — a fronteira de último recurso depende disso).
2. `app/failureRegistry.ts` + `app/FailureScreen.tsx` (puros, sem fronteira ainda — testáveis isolados).
3. `app/RootErrorBoundary.tsx`, ligado em `main.tsx`.
4. `app/MatchErrorBoundary.tsx` (loop-breaker incluso), ligado na fase `'playing'` de `OnlineGate.tsx`.
5. `app/AccessoryErrorBoundary.tsx`, ligado em `CenterLog` e `SoundLayer`.
6. Ambiente de teste (`vitest.config.ts` + deps) + suíte de componente para 2–5 (FR-023/024).
7. `Transport.rejectCommand` (contrato + os dois adapters) + `host.accept()` com try/catch + `client.lastCommandFailure` + toast em `OnlineGate` (US5 — isolado, pode andar em paralelo com 2–5).
8. Coletor global (`window.onerror`/`unhandledrejection`) em `main.tsx`, usando o mesmo `failureRegistry`.
9. E2E (FR-025) + `docs/SRS.md`/changelog já batidos (v1.8 já está feito).
