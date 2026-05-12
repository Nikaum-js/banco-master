# Data Model — Construção (Fase 1)

Estende o estado da 003. Tudo serializável. Aditivo — nada removido.

---

## Extensão de `Title` (003)

| Campo | Tipo | Notas |
|---|---|---|
| `houses` | number | **NOVO** — 0–4 (só cidades; aeroporto/utilidade ficam 0) |
| `hotel` | boolean | **NOVO** — `true` = hotel construído (substitui 4 casas) |

`ownerId`/`mortgaged` inalterados.

## Extensão de `GameState`

| Campo | Tipo | Notas |
|---|---|---|
| `bank` | `BankStock` | **NOVO** — estoque global; semente `{ houses: 40, hotels: 16 }` (D-017) |

`resolution` ganha mais uma variante (abaixo).

### Entidade: BankStock

| Campo | Tipo | Notas |
|---|---|---|
| `houses` | number | casas disponíveis (de 40) |
| `hotels` | number | hotéis disponíveis (de 16) |

### Extensão de `ResolutionSlice` (003)

```
| { kind: 'house-auction'; auction: HouseAuction }   // NOVO (escassez de casas)
```

### Entidade: HouseAuction

| Campo | Tipo | Notas |
|---|---|---|
| `housesAvailable` | number | quantas casas estão em disputa |
| `currentBid` | number | lance atual |
| `highBidder` | string \| null | maior licitante |
| `activeBidders` | string[] | interessados em construir |
| `deadline` | number | epoch ms (serializável; timer reconstruível) |

---

## Nível de construção (derivado)

`ConstructionLevel = 0 | 1 | 2 | 3 | 4 | 'hotel'` — derivado de `Title.hotel ? 'hotel' : Title.houses`.

## Valores provisórios (tema — ver research D3)

| Item | Fórmula provisória | Origem |
|---|---|---|
| Aluguel 1–4 casas | `square.rent × [5,15,45,80]` | tema substitui |
| Aluguel hotel | `square.rent × 100` | tema substitui |
| Custo de construção | `round(square.price / 2)` | tema substitui |
| Venda | metade do custo | §5.3 |

Multiplicador final: `× 0.7` (grupo parcial/maioria) ou `× 1.0` (grupo completo) — §13.3.

---

## Invariantes validáveis (viram testes)

1. Build exige maioria do grupo, nenhuma hipotecada, caixa ≥ custo, estoque > 0.
2. Uniformidade: `max(houses no grupo) - min(houses no grupo) ≤ 1`; build só na de menor contagem.
3. Sequência 0→1→2→3→4→hotel; hotel zera `houses` e seta `hotel`, devolvendo 4 casas ao `bank`.
4. `bank.houses`/`bank.hotels` nunca negativos; build decrementa, venda/desmonte incrementa.
5. Aluguel com construção = `tabela(nível) × (0.7 | 1.0)` e **substitui** base/150%/200% da 003.
6. Vender = +metade do custo ao caixa; construção volta ao estoque; hotel→4 casas ou desmonte forçado do grupo (§5.5) se `bank.houses < 4`.
7. Leilão de casas: `currentBid` crescente, ≤ caixa; vencedor paga ao banco e recebe as casas (que saem do estoque para a propriedade).
8. Round-trip JSON do `GameState` estendido preserva tudo.
