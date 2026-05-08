# Quickstart — Leilão de casas em escassez (026)

## O que entrega

Botão "Leilão de casas" (quando o banco tem casas e há ≥2 jogadores) abre uma disputa pelas casas disponíveis; os jogadores dão lances e, ao encerrar, o vencedor paga e leva as casas (saem do estoque do banco). Evento autônomo — não mexe no turno.

## Validação automatizada

```bash
bunx vitest run tests/game    # houseAuction.test.ts (reescrito p/ a API de campo) + activeModal.test.ts (sem house-auction)
bun run build                 # type-check + build (exit 0)
```

- Reducers `openHouseAuction`/`placeHouseBid`/`closeHouseAuction` cobertos (SC-005), incluindo turno intacto.

## Validação visual (manual — sem RTL)

```bash
bun run dev
```

1. Garanta que o banco tem casas (estado inicial: 40) e ≥2 jogadores. Clique **"Leilão de casas"** no painel de jogadores.
2. No modal: veja N casas em jogo; escolha um licitante, informe um valor (> atual, ≤ caixa) e "Dar lance" — o lance atual e o maior licitante atualizam.
3. "Encerrar": o vencedor paga (delta de caixa aparece no painel) e o estoque de casas do banco diminui; o modal fecha.
4. Encerre sem lance → nada muda além de fechar.
5. Confirme que o turno do jogador da vez segue igual antes/depois (o dado central, estado etc. não mudam).

## Critério de pronto

- Testes verdes; build limpo.
- Abrir/lance/encerrar funcionam; turno intacto.
- Gatilho desabilitado sem casas / com <2 jogadores / com leilão já aberto.
- Acabamento do modal aprovado no `bun run dev`.
