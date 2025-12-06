# Implementation Plan: Limpeza na eliminação (§9.4)

**Branch**: `main` (feature dir `019-limpeza-eliminacao`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/019-limpeza-eliminacao/spec.md`

## Summary

Arremate do M1: o `declareBankruptcy` (008) passa a **limpar**, na eliminação (§9.4): (a) imunidades de aluguel **concedidas** pelo eliminado (`granterId`) e **recebidas** (`beneficiaryId`); (b) `tempEffects` **originados** por ele (`ownerId`). Para distinguir "concedidas", o `Immunity` (014) ganha `granterId?` (setado no `executeTrade`). Mudança pequena e pura; reusa o ponto de eliminação existente. Transferência de imunidade (§8.4) segue deferida.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8). **Dependencies**: nenhuma nova. **Storage**: `Immunity += granterId?` (serializável); sem outro estado novo. **Testing**: Vitest (puro). **Constraints**: limpeza atômica dentro do `declareBankruptcy`; sem mudança de comportamento fora da eliminação.

**Scale/Scope**: `Immunity` (economy/types) + `executeTrade` (trade.ts seta granterId) + `declareBankruptcy` (falencia.ts: 2 filtros) + 1 teste novo + 1 asserção do 014 atualizada.

## Constitution Check

| Princípio | Avaliação | Status |
|---|---|---|
| I. SRS verdade | Operacionaliza §9.4 (literal). | ✅ |
| II. Discovery antes de código | Spec aprovada; escopo escolhido pelo usuário. | ✅ |
| VI. Privacidade de cartas | N/A (imunidades/efeitos são públicos). | ✅ |
| VII. Resiliência | `granterId` é dado puro; filtros puros; snapshot serializável. | ✅ |

(III/IV/V N/A.) **Sem violações.**

## Project Structure

```text
specs/019-limpeza-eliminacao/{plan,research,data-model,quickstart}.md · contracts/limpeza.md · checklists/

src/game/economy/types.ts     # MOD — Immunity += granterId?: string
src/game/economy/trade.ts     # MOD — executeTrade seta granterId ao conceder imunidade
src/game/falencia/falencia.ts # MOD — declareBankruptcy: filtra immunities (granter/beneficiário) + tempEffects (owner) do eliminado
tests/game/falencia/limpeza-eliminacao.test.ts # NOVO — SC-001..003
tests/game/economy/imunidade.test.ts           # MOD — 1 asserção inclui granterId
```

**Structure Decision**: a limpeza vive no `declareBankruptcy` (dono da eliminação) como 2 filtros após eliminar. `granterId` no `Immunity` é o mínimo para o §9.4 distinguir concedidas; setado só no `executeTrade` (única origem de imunidade), opcional para não quebrar literais.

## Complexity Tracking

> Sem violações. Vazio.
