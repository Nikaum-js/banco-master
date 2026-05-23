# Implementation Plan: Modais informativos — Free Parking & Aquisição Hostil sofrida (§12.2)

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Depende de**: 007 (Free Parking / `collectCenter`) · 016 (Aquisição Hostil / `acquire`) · 022 (overlay de modal central) · 020 (camada ao vivo)

## Summary

Fechar os 2 últimos modais do §12.2 com um **evento autônomo** no estado: `GameState.notice: Notice | null` (variantes `free-parking` e `hostile-takeover`), no padrão de `pendingTrade`/`houseAuction` (serializável, não bloqueia o turno). Hook mínimo no motor: `collectCenter` (007) registra a notificação de Free Parking com o valor coletado; `acquire` (016) registra a de Aquisição Hostil sofrida com vítima/atacante/propriedade. Reducer `dismissNotice` limpa. UI: `NoticeLayer` (overlay) exibe a notificação ativa + "OK". Comportamento existente (coleta/transferência) inalterado.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19. **Deps**: Zustand, Tailwind, Vite 8, Vitest (sem novas).

**Storage**: N/A — `GameState.notice` (JSON puro, serializável).

**Testing**: Vitest sobre `collectCenter` (seta free-parking), `acquire` (seta hostile-takeover) e `dismissNotice` (limpa). Modal validado no `bun run dev`.

**Constraints**: não alterar a economia do Free Parking nem a regra da Aquisição; não bloquear o turno; pt-BR.

**Scale/Scope**: 1 tipo + 1 campo no `GameState` + 2 linhas de registro + 1 reducer de dispensa + 1 comando + 1 camada de UI + mount.

## Constitution Check

- **I. SRS**: ✅ §12.2 (modais obrigatórios). **II. Discovery**: ✅ spec 030. **III/IV/V**: ✅ n/a. **VI. Privacidade**: ✅ notificações não revelam mão/cartas. **VII. Resiliência**: ✅ `notice` é JSON puro no `GameState`; reconstruível, sem efêmero fora do estado.

**Resultado**: PASS. Free Parking (007) e Aquisição (016) intactos → suíte verde. Sem Complexity Tracking.

## Project Structure

```text
src/
├── game/turn/types.ts          # + type Notice; GameState.notice
├── game/turn/turnMachine.ts    # + dismissNotice(state) (reducer puro)
├── game/balancing/balancing.ts # collectCenter → seta notice free-parking
├── game/cards/ofensivas.ts     # acquire → seta notice hostile-takeover
├── game/store.ts               # seed notice:null + comando dismissNotice
├── game/ui/NoticeLayer.tsx     # NOVO — overlay da notificação ativa + "OK"
└── App.tsx                     # monta NoticeLayer

tests/
└── game/economy/notice.test.ts # collectCenter / acquire setam; dismissNotice limpa
```

**Structure Decision**: Single project. `notice` é um campo de `GameState` (como `pendingTrade`/`houseAuction`); a UI é uma camada fina que lê o campo e dispara `dismissNotice`.

## Notas de design

- **Por que evento autônomo, não `resolution`**: notificação é informativa, não decisão — não deve bloquear `finalizeTurn`. Resolução bloqueia; `notice` não. Mesma escolha do 024/026.
- **Onde registrar**: `collectCenter` conhece `playerId` e o `amount` (= `centerPot` antes do reset) — registra ali; `acquire` conhece vítima/atacante/pos — registra no sucesso, depois da transferência. Nenhuma outra regra muda.
- **Substituição simples**: sem fila; um novo evento sobrescreve. Suficiente no v1 (informativo).
- **Per-cliente (M3)**: o dado já carrega `victimId`/`playerId`; o roteamento por tela é do M3. No single-client, exibe na tela atual.

## Complexity Tracking

> Sem violações — seção vazia.
