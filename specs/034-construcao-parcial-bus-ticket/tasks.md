# Tasks: Construção com país parcial + timing do Bus Ticket

Ordem dependente. `[x]` = feito nesta sessão.

## A. Construção & aluguel
- [x] T01 — `rent.ts`: `posseFactor(owned,size)` + trocar ramo construído de `0.7/1.0` por `table×fator`.
- [x] T02 — `construction.ts`: remover trava de maioria em `canBuild` (limpar `majority` se órfã).
- [x] T03 — `deedView.ts`: remover `'maioria'` de `buildBlock` e do tipo `BuildBlock`.
- [x] T04 — `shared.tsx`: remover chave `maioria` de `BUILD_BLOCK_MSG`.

## B. Bus Ticket
- [x] T05 — `turnMachine.ts`: `useBusTicket` aceita `aguardando-finalizacao` além de `aguardando-rolagem`.
- [x] T06 — `GameHUD.tsx`: pílula mostra "Usar Bus Ticket" também em `aguardando-finalizacao`.
- [x] T07 — `ModalLayer.tsx`: `showBusArmed` aceita `aguardando-finalizacao`.

## Testes
- [x] T08 — `rent.test.ts`: fator 50/75/100 (trio) + 50/100 (duo) + monotonicidade; remover asserts de 70%.
- [x] T09 — `construction.test.ts`/`construcao-avancada.test.ts`: construir com 1 cidade OK; arranha-céu ainda exige país completo.
- [x] T10 — `deedView.test.ts`: ajustar asserts de `maioria`.
- [x] T11 — `busticket.test.ts`: usar ticket em `aguardando-finalizacao`.
- [x] T12 — Rodar `bunx vitest run tests/game`; corrigir quebras residuais.

## Docs & gate
- [x] T13 — SRS §5.1/§13.3 + §10.7.
- [x] T14 — DECISIONS: revisar D-004 + nota Bus Ticket.
- [x] T15 — Gate: tsc + vitest + build; verificação visual (popover + pílula).
