# Data Model — Tabuleiro de 48 Casas

**Fase 1** · entidades e mudanças de schema. Base: `src/lib/boardData.ts` (já existente). Mudanças são **aditivas** — nada é removido do schema atual.

---

## Entidade: Square (casa)

Unidade base do tabuleiro. Discriminada por `kind`.

| Campo | Tipo | Notas |
|---|---|---|
| `pos` | number | 0–47 (era 0–39). Índice no percurso horário. |
| `kind` | SquareKind | discriminador (ver abaixo) |
| `name` | string | nome exibido |
| `short?` | string | rótulo curto (cantos) |

**`SquareKind`** — **adiciona** `'bus-ticket'`:

```
corner-go | corner-jail | corner-parking | corner-gotojail
property | airport | utility | surpresa | tesouro | tax
bus-ticket   ← NOVO
```

### Subtipo: PropertySquare
| Campo | Tipo | Notas |
|---|---|---|
| `group` | GroupKey | uma das 8 cores/países |
| `price` | number | preço de compra (escada $60–$400) |
| `rent` | number | aluguel base |
| `uf` | string | ISO-3166-1 alfa-2 (bandeira-avatar) |
| `capital?` | string | país (rótulo) |

### Subtipo: AirportSquare
`price`, `rent`, `iata`. 4 no tabuleiro (pos 6/18/30/42), aluguel escalando $25/$50/$100/$200.

### Subtipo: UtilitySquare
`price`, `icon: 'fuel' | 'bolt' | 'gas'` ← **adiciona `'gas'`**. 3 no tabuleiro (pos 14/32/43). Aluguel 4×/10×/20× o valor dos dados (1/2/3 possuídas).

### Subtipo: TaxSquare
`amount`. 2 no tabuleiro (pos 4 = $200, pos 45 = $100).

### Subtipo: BusTicketSquare ← NOVO
```
{ kind: 'bus-ticket'; name: string }
```
Sem campos de propriedade. 1 no tabuleiro (pos 10). Ao parar: concede 1 carta Bus Ticket (contador separado, D-012) se houver no baralho. Não-comprável, não-hipotecável.

### Subtipos Corner / Surpresa / Tesouro
Inalterados (apenas mudam de posição: cantos 0/12/24/36).

---

## Entidade: Group (grupo de cor / país)

`GROUPS: Record<GroupKey, { name; bg; token }>` — **inalterado em schema**. Muda só o número de propriedades por grupo (premium = 4, regular = 3). Tamanho do grupo é derivado contando entradas de `BOARD` com aquele `group` (não há campo de tamanho explícito hoje; manter assim).

| GroupKey | País | size |
|---|---|---|
| brown | Itália | 3 |
| skyblue | Egito | 3 |
| pink | Japão | 3 |
| orange | Índia | 4 |
| red | China | 4 |
| yellow | Brasil | 4 |
| green | EUA | 4 |
| navy | Reino Unido | 3 |

**Regra derivada (monopólio parcial, §13.3):** limiar de construção parcial = `ceil(size/2)+...` na prática "maioria" → grupo de 3 constrói com 2; grupo de 4 constrói com 3. Aluguel cheio só com o grupo completo.

---

## Invariantes (validáveis)

1. `BOARD.length === 48`.
2. Cantos exatamente em `pos ∈ {0,12,24,36}` com os 4 kinds de canto corretos.
3. Contagem por kind: property 28 · airport 4 · utility 3 · surpresa 3 · tesouro 3 · tax 2 · bus-ticket 1 · corner 4.
4. Por grupo: brown/skyblue/pink/navy = 3; orange/red/yellow/green = 4.
5. `pos` contíguos e únicos de 0 a 47.
6. 1 aeroporto por lado (exatamente um airport em cada faixa bottom/left/top/right).

---

## Estado de runtime (fora do schema de dados estático)

Donos, construções, hipoteca, posições de jogador, pote da Loteria — vivem no estado da partida (Zustand/Supabase), não no `boardData.ts`. Esta feature **não** altera o shape desse estado; ele apenas passa a referenciar `pos` de 0–47.
