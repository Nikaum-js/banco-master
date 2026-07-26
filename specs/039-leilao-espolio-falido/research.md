# Research — Leilão do espólio do falido-ao-banco (039)

O que foi investigado no código antes de desenhar, e o que foi descartado.

## R1 — Onde exatamente está a lacuna

`src/game/falencia/falencia.ts`, no laço de `declareBankruptcy`:

```ts
t.ownerId = heirId // credor do empréstimo (§9.3) ou da dívida (§9.2); banco se null.
```

`heirId` é `loan ? loan.creditorId : debtCreditorId`. Quando o jogador devia **ao banco** (`debtCreditorId === null`) e não tinha empréstimo ativo, `heirId` é `null` e **toda** propriedade dele perde o dono de graça. Não há leilão em lugar nenhum do caminho.

O comentário do próprio arquivo já apontava o §9.2 — a regra estava lida, só não implementada.

## R2 — Quanto do pregão de escassez é reusável: quase tudo

Auditei `src/game/economy/landAuction.ts` (137 linhas) função por função:

| Função | Reusável no espólio? | Por quê |
|---|---|---|
| `placeLandBid` | **Integral** | Não sabe de onde o lote veio: valida licitante, superação do lance e solvência. |
| `committedCash` | **Integral** | Soma lances líderes do jogador; agnóstica à origem. |
| `settleLot` | **Integral** | "Vencedor paga ao banco e vira dono; sem lance fica livre" é literalmente FR-010/FR-011. Já trata licitante eliminado no meio-tempo e caixa que caiu entre lance e fecho. |
| `closeExpiredLandLots` | **Integral** | Fecha por prazo próprio de cada lote; some quando não sobra nenhum. |
| `closeLandAuction` | **Integral** | Force-close. |
| `freeLots` | **Não usar** | É a *contagem de terrenos sem dono* — conceito da escassez. O espólio é definido pela posse do falido, não pela ausência de dono. |
| `maybeOpenLandAuction` | **Não reusar como gatilho** | Carrega a trava de episódio (`landAuctionArmed`) e o limiar de contagem. Nada disso pertence ao espólio. |

Conclusão que dirigiu o desenho: **só falta um abridor**. Daí a fatia ser tão pequena — e daí a promessa do plan de que as cinco primeiras funções ficam sem um caractere alterado.

## R3 — Formato: por que não uma fila de leilões comuns

Alternativa considerada e **descartada em D-031** (registro aqui do que foi medido):

O leilão comum (`economy/auction.ts`, spec 003) vive dentro de `GameState.resolution`. `resolution` é **slot único** e **bloqueia o turno** — o fix `e5bb33e` documenta como esse slot já é disputado. Usá-lo para o espólio traria dois problemas independentes:

1. **Bloqueio de turno errado.** O espólio nasce no turno do falido, mas quem lucra com ele são os outros. Enfileirar N leilões dentro de `resolution` congelaria a mesa por `8s × N` **antes** de a vez passar. Com 8 propriedades, mais de um minuto.
2. **Colisão de slot.** A falência já limpa `resolution` no fim (`s.resolution = null`) porque a dívida-gatilho vivia lá. Abrir um leilão nesse mesmo campo, no mesmo comando, é reentrar num slot que a função acabou de esvaziar.

O pregão simultâneo não tem nenhum dos dois: é evento autônomo (como `pendingTrade`, `notice`, `landAuction`), resolve tudo numa janela e não toca no turno.

## R4 — Colisão com pregão de escassez: injetar vs enfileirar

`maybeOpenLandAuction` começa com `if (state.landAuction) return state` — um pregão por vez, deliberadamente. O espólio precisa de política.

**Injetar** (escolhido): o formato já é indiferente a lotes com prazos diferentes — cada `LandLot` tem seu `deadline` e `closeExpiredLandLots` fecha um por um. Acrescentar lote a um pregão aberto **não exige nada novo** além do `push`. Prazos existentes ficam intactos porque só os lotes novos recebem `now + WINDOW`.

**Enfileirar** (descartado): exigiria um campo de espera (`pendingEstate`) no `GameState`, uma checagem de "abriu vaga" a cada fecho, e criaria um estado que o jogador não vê — leilão que vai acontecer e ninguém anunciou. Mais estado para menos informação.

Consequência aceita da injeção: **os `bidders` do pregão em curso são recalculados**. Isso é o comportamento certo (o recém-falido não pode continuar licitando nos lotes de escassez), mas é uma mudança em lotes que já existiam — daí FR-017 e um cenário de aceitação próprio.

## R5 — `origin` com três valores, e por que não por lote

`'scarcity' | 'bankruptcy' | 'mixed'`.

Considerado: `LandLot.origin` (origem por lote), que daria informação mais fina — a UI poderia marcar cada card. Descartado por custo/benefício: `LandLot` é a estrutura que `placeLandBid`/`settleLot`/`closeExpiredLandLots` manipulam, e a spec promete não tocá-las. Adicionar campo que essas três funções carregam e ignoram, para servir um título de cabeçalho, é peso no lugar mais quente da mecânica.

`'mixed'` existe porque FR-020 é explícito: um pregão com lotes das duas origens não pode se anunciar como só uma. Sem o terceiro valor, ou o título mente ou a UI passa a inferir origem contando lotes — inferência que erra assim que o último lote de uma origem fecha.

## R6 — `bankruptId` no estado, nome fora dele

FR-021 pede o nome do falido no título. Nome de jogador **não vive no `GameState`** (D-019: sala e partida são separadas; `playersView`/`identityOf` da 038 resolvem id → nome). Então o pregão guarda `bankruptId: string | null` e a UI resolve via `identityOf`, com o mesmo fallback `Jogador N` que a 038 já tem.

Guardar o nome no `GameState` seria mais simples de renderizar e **errado**: duplicaria a fonte da identidade e faria o snapshot depender da sala.

## R7 — Convergência: o `now` tem que passar pelo `ctx`

`src/net/recorder.ts` embrulha `ctx.rng` e `ctx.now`, grava no host e reproduz no cliente — é o que faz host e clientes convergirem byte a byte (037/FR-011). Qualquer `Date.now()` direto dentro de um reducer produziria prazos diferentes por cliente e quebraria SC-006.

Portanto `declareBankruptcy` consome `ctx.now?.()` e repassa. Verificado que `replayCtx` falha alto em underflow — se o número de chamadas a `now()` divergir entre host e cliente, o erro aparece como exceção de divergência, não como estado silenciosamente diferente. Isso é rede de segurança para D3 do plan.

## R8 — O que já cobre esta feature sem escrever teste novo

O fuzzer da 036 (`tests/sim/`) dirige `declare-bankruptcy` e roda o **oráculo independente de conservação de dinheiro** (`tests/sim/engine/conservation.ts`), que já conhece os mecanismos `declare-bankruptcy`, `declare-bankruptcy-sink` e `land-auction-close`. Com o espólio, o caminho `land-auction-close` passa a ser alcançável por uma segunda via, e o oráculo confere o valor exato saindo do caixa do vencedor — sem caso novo. Vale rodar `bun run sim:batch` depois de implementar e confirmar que `declare-bankruptcy-sink` continua fechando (SC-007).

Ponto de atenção medido: o relatório do sim lista mecanismos com **zero ocorrências** como gap de cobertura. Se `land-auction-close` estava perto de zero nos lotes atuais, o espólio deve subir essa contagem — e se não subir, é sinal de que o gatilho não está sendo alcançado pelo fuzzer, não de que está correto.
