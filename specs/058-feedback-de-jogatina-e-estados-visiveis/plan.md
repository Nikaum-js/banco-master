# Implementation Plan: Feedback de jogatina e estados visíveis

**Branch**: `main` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/058-feedback-de-jogatina-e-estados-visiveis/spec.md`

## Summary

Dez sintomas, **seis** causas-raiz distintas — cinco delas medidas no produto renderizado ou no
código antes de qualquer linha ser escrita. O trabalho é quase todo de **projeção**: transformar
estado autoritativo que o motor já mantém em leitura que o jogador entende, sem duplicar regra em
componente React. Onde há defeito, ele está numa **primitiva compartilhada** — e é lá que a
correção entra, não na superfície que reclamou.

## Technical Context

**Language/Version**: TypeScript 6, React 19 (compiler ligado), Vite 8

**Primary Dependencies**: Zustand (store), Tailwind 4, `motion`, Supabase (transporte)

**Storage**: nenhuma mudança — sem migration, sem DDL, sem Supabase

**Testing**: Vitest (unidade + jsdom), Playwright (`dev` e `built`), `@axe-core/playwright`

**Target Platform**: navegador; retrato de celular a partir de 320×568 (D-079)

**Project Type**: SPA de jogo (MPA no build: `play.html` é o entrypoint do jogo)

**Constraints**: sem dependência nova; sem regra nova; sem PII no `GameState`; alvo de toque
≥44 px; zero rolagem horizontal no documento

**Scale/Scope**: ~10 superfícies, 2 mapas, 2–8 jogadores, 10 viewports

---

## Constitution Check

| Princípio | Como esta spec o respeita |
|---|---|
| **I. SRS é verdade absoluta** | A única mudança de regra (Estatização) nasceu na [D-080](../../docs/adr/D-080-estatizacao-dura-uma-volta.md) e subiu o SRS a v1.40 **antes** desta spec. Todo o resto é apresentação |
| **II. Discovery antes de código** | Spec aprovada com autorização explícita do usuário; ADR antes da regra |
| **III. Tesouro impacta** | Intocado |
| **IV. Catch-up discreto** | Nenhuma superfície nova rotula mecânica de catch-up |
| **V. Sem cooperação obrigatória** | Intocado |
| **VI. Privacidade de cartas** | O fato de reação só é registrado **depois** de a carta ser usada; nada da mão trafega antes |
| **VII. Resiliência de sessão** | O cue de negociação não entra no `GameState` e não re-toca em reconexão; nada novo é persistido |

Sem violações. **Complexity Tracking** vazio de propósito.

---

## Causas-raiz medidas

### C1 — Popover de aeroporto/utilidade/mina nunca teve bloco de posse

`PropertyDeedContent` (`src/boards/shared.tsx`) tem o bloco `property-deed__status` com dono e
hipoteca. `AirportPopover`, `UtilityPopover` e `MinePopover` **não têm bloco equivalente** — não é
regressão, é ausência desde a origem. Três superfícies, três chances de divergir.

> **Correção:** extrair uma primitiva `TitleOwnership` e consumi-la nas **quatro**, incluindo o
> estado **livre**, que hoje nenhuma delas apresenta.

### C2 — `respondReaction` não emite fato quando a Diplomacia é usada

`src/game/cards/reacao.ts:106–119`: no ramo `use === true`, a carta é removida da mão, a ofensiva
volta ao fundo do deck, `resolution` é zerada — e **nenhum `logEvent`**. O ramo `use === false`
também não loga a reação (correto), mas a ofensiva aplicada loga por conta própria. Resultado: o
único desfecho sem fato nenhum é justamente o mais surpreendente da mesa.

> Molde idêntico ao dos seis furos que a [D-063](../../docs/adr/D-063-toda-mutacao-de-caixa-tem-causa-registrada.md)
> listou: um ramo correto e silencioso.

> **Correção:** espécie nova `reaction-blocked` no log tipado, emitida **só** no ramo `use`.

### C3 — `LoanPanel` procura o empréstimo do jogador da vez

`src/boards/shared.tsx:1290–1292`:

```ts
const active = game.players[game.turnOrder[game.activeSeat]]
const loan = game.loans.find((l) => l.debtorId === active.id)
if (!loan) return null
```

`game.loans` é uma lista. O painel lê **um** elemento dela, escolhido pelo assento da vez. Uma
dívida entre dois adversários existe no estado o tempo todo e **some da tela** até chegar a vez do
devedor. O view-model `playersView` já faz a leitura certa (`loans.some(...)` por jogador) — o
painel é que nunca a usou.

> **Correção:** projeção `loansView(game, room, localSeat)` sobre a lista **inteira**; resumo
> compacto na área de jogadores; detalhe em modal com `ModalShell`.

### C4 — Bandeira 3:2 forçada em holder 1:1, em dois sítios, por dois mecanismos

Medido no navegador, não deduzido.

**No tabuleiro** (`FlagAvatar` → `CountryFlag fill`): `preserveAspectRatio="xMidYMid slice"` numa
caixa quadrada cobre o quadrado cortando **1/3 da largura**, 1/6 de cada lado. Para a bandeira dos
Emirados — a única do catálogo cuja composição depende de uma barra vertical de exatamente 25% na
tralha — isso come **2/3 da barra**, que sobra como um fio. Abu Dhabi e Dubai são as duas casas
`AE` do tabuleiro: por isso o relato nomeia essas duas, e só essas.

**No pregão** (`CountryFlagDisc`): pior, e por outro motivo. O disco renderiza
`<CountryFlag size={size*1.5}>` **sem** `fill`, então o SVG sai com 45 px de largura dentro de um
`span` de 30 px com `overflow: hidden` e `place-items: center`. Item de grade **maior** que a área
não fica centrado — a borda inicial é ancorada e todo o excedente transborda para **um** lado.
Medido: `leftCut: 2px` (só a borda), `rightCut: 17px`. A janela visível é o `viewBox` x **0–34,7**
de 60: a Itália perde **a faixa vermelha inteira**, e o disco vira um emblema verde-e-branco que
não identifica país nenhum.

> **Correção, única e compartilhada:** `CountryFlag` com `fill` passa a **conter** (`meet`) em vez
> de cobrir, e `CountryFlagDisc` deixa de ampliar 1,5× e passa a usar `fill`. Nenhum recorte,
> nenhuma deformação, nenhum caso especial por casa. Validado no navegador nas dez bandeiras
> (AE, BR, CN, DE, EG, ES, FR, IT, JP, US) e nos quatro lados do tabuleiro.
>
> O zoom de 1,5× existia com a justificativa de que "recortada em círculo a bandeira perde as
> pontas". Verdade — mas a cura era pior: perder as pontas custa as quinas; ampliar e recortar
> custou uma faixa inteira. Contendo, o círculo corta só as quinas de novo, e a composição
> sobrevive.

### C5 — O pregão lê o relógio local sem corrigir o deslocamento do host

`LandAuctionLayer.tsx` mantém `now` via `setInterval(() => setNow(Date.now()), 250)` e calcula
`remainingMs = lot.deadline - now`. Mas `lot.deadline` é epoch **do host**.

O projeto **já resolveu isso** em outro lugar: `net/client.ts:139–143` estima `clockOffsetMs` a
cada comando aceito, `roomStore` o publica, e `ModalLayer.tsx:883` (leilão comum) e
`LiveRegion.tsx:64` o consomem — `deadline - (localNow + clockOffsetMs)`. O pregão foi o único que
ficou de fora, **contrariando o próprio comentário de topo do arquivo**, que afirma que o prazo é
"corrigido pelo offset de relógio do host".

Com o relógio do cliente atrasado N segundos em relação ao host, o cronômetro exibe `24 + N`. Foi
o que a jogatina viu como "cresceu até uns 30 segundos".

> **Correção:** consumir `clockOffsetMs`, e **fechar o valor exibido dentro da janela**
> (`min(window, max(0, remaining))`) — a correção de offset é uma estimativa, e um teto explícito
> é o que torna o requisito verificável em vez de dependente da qualidade da amostra.
>
> **O soft-close não muda:** um lance válido continua reiniciando o prazo daquele lote em 24 s
> (SRS §7.3). A regra é do motor (`placeLandBid`), e o motor não é tocado.

### C6 — Efeitos e imunidades são apresentados como rótulo, não como fato

`effectRow` (`shared.tsx:673–690`) produz `desc`/`detail` em prosa fixa: "Alvo sem construir" sem
nomear o alvo, "Jogador protegido" sem nomear o jogador — porque a função **não recebe a sala** e
por isso não consegue resolver identidade. E `Player.immune` é um booleano
(`immunities.some(...)`), que joga fora beneficiário, propriedade, concedente e prazo que
`game.immunities` já carrega.

> **Correção:** dois display models tipados novos, puros e testáveis em node, fora do React —
> mesmo corte que `playersView`/`activeHudView` já estabeleceram.

---

## Decisões de design

### D1 — Uma primitiva de posse, quatro consumidores

`TitleOwnership` recebe `{ ownerId, mortgaged }` e a sala, e devolve as três leituras possíveis:
**livre**, **dono nomeado**, **dono + hipotecada**. Nenhum popover reimplementa a leitura, e o
estado **livre** — hoje ausente em todos, inclusive na cidade — passa a ser dito em voz alta.
Motivo de existir: quatro cópias divergindo é exatamente como a utilidade ficou sem dono por
meses sem ninguém notar.

### D2 — `reaction-blocked` é um fato, não uma frase

Espécie nova do `LogEntry`, com `who` = **reator** (o autor do fato é quem reagiu), `attackerId`,
`effect` (id canônico do efeito ofensivo), `targetPos` e `targetPlayer`. A frase em português é
composta em `describeLog`, como todas as outras. Cinco pontos exaustivos precisam tratá-la —
`ALL_LOG_KINDS`, a união, `describeLogEntry`, `logKey`, `classifyLogEntry` — e é o compilador que
cobra, porque os quatro últimos terminam em `assertNever`.

**Cue sonoro:** `classifyLogEntry` devolve `null` para a espécie nova. O cue `reaction` **já toca**
na borda de subida de `resolution.kind === 'reaction-diplomacia'` (`cueForResolution`), ou seja,
quando a janela **abre**. Dar cue ao fato tocaria duas vezes o mesmo episódio — a proibição da
FR-011 e o mesmo raciocínio que já mantém `lot-won` mudo.

### D3 — Empréstimo: resumo derivado, detalhe modal

`loansView` devolve, para a lista inteira: por empréstimo `{ debtor, creditor, principal, ratePct,
interest, lapsLeft, payoff, iAmDebtor, iAmCreditor }`, e no topo `{ count, mostUrgent }`. O resumo
compacto vive na área de jogadores (onde a dívida é lida junto do caixa); o detalhe abre em
`ModalShell` + `Overlay` — as primitivas que já implementam foco inicial, devolução de foco, Escape
e rolagem interna, e que a §12.6 exige.

**Autorização:** a ação de quitar continua atrás de `local.mayActAction({ kind: 'pay-off-loan' })`,
a **mesma** tabela que o host usa para descartar comando ilegítimo. Quem não é o devedor local vê
o detalhe em somente leitura — não um botão desabilitado, que mentiria sobre haver ação ali.

### D4 — Imunidade tem duas naturezas, e a interface diz qual

`immunityView` separa, por construção:

- **por propriedade** (`game.immunities`, §8.4): beneficiário, `pos`, concedente quando houver
  (`granterId`), e prazo — `lapsRemaining` ou **permanente** quando `null`;
- **total temporária** (`tempEffects` de tipo `imunidade-total`, §10.6): jogador e prazo.

O resumo na linha do jogador deixa de ser `IMU` booleano e passa a contar. "Contra quem" só é
exibido quando `granterId` existe: onde a regra não registra vínculo, a interface **omite** em vez
de inventar (FR-027).

### D5 — `effectRow` passa a receber a sala

A assinatura ganha `room`, e `Room | null` continua válido — `identityOf` já tem fallback para
partida sem sala. O retorno ganha `scope: 'mesa' | 'jogador' | 'propriedade'`, `subjectId` e
`place`, e o consumidor compõe a frase. A duração continua vindo de `e.lapsRemaining`: é o que faz
a D-080 não exigir nenhuma edição de texto de painel.

### D6 — `trade-open`: cue de UI, disparado pela transição do store de UI

O gatilho é a transição `false → true` de `useTradeUI.open` — não o `GameState`, que não sabe que
uma negociação foi aberta e **não deve** saber (FR-045). Um `useEffect` com dependência no
booleano dispara exatamente uma vez por abertura; re-render não dispara; reconexão não dispara,
porque o store de UI é local e não é reidratado. Mudo e autoplay são responsabilidade do
`engine.play`, que já os trata.

**Equivalente visual:** o modal aparecendo é a confirmação visual, e ela é anterior ao som — o
requisito FR-048 está satisfeito pela própria ordem dos fatos, sem elemento novo.

**Asset:** `trade-open.ogg`, **sintetizado neste repositório** por um script determinístico
(folha de papel + clique de ficha + carimbo), o que resolve licença por construção — obra
própria, sem terceiro. Vai para `src/assets/sfx/`, onde o `import.meta.glob` de `cues.ts` o
auto-mapeia sem editar código, e é documentado em `README.md`/`SOUND-DESIGN.md`.

### D7 — Andaimes de cenário, não mutação frágil no E2E

Os estados determinísticos que faltam (empréstimos múltiplos, imunidades das duas naturezas,
efeitos ativos variados, aeroporto/utilidade livre-comprado-hipotecado) entram como
`?scenario=…` em `src/game/ui/e2eScenario.ts` e como casos do **Laboratório Visual** — o mesmo
molde de `?scenario=pregao`, que **dispara** o reducer de produção em vez de plantar estado
literal. Andaime que planta estado dá tela verde sobre motor morto.

---

## Estrutura

```text
specs/058-feedback-de-jogatina-e-estados-visiveis/
├── spec.md
├── plan.md            # este arquivo
├── tasks.md
└── checklists/

src/
├── boards/
│   ├── glyphs/flags.tsx          # C4 — as duas correções de geometria
│   └── shared.tsx                # C1 (popovers), C3 (LoanPanel), C6 (efeitos)
├── game/
│   ├── cards/reacao.ts           # C2 — logEvent no ramo `use`
│   ├── economy/types.ts          # LogEntry + ALL_LOG_KINDS
│   └── ui/
│       ├── panels/
│       │   ├── loansView.ts      # novo — D3
│       │   ├── immunityView.ts   # novo — D4
│       │   └── effectsView.ts    # novo — D5
│       ├── deed/TitleOwnership   # novo — D1
│       ├── log/describeLog.ts    # frase da espécie nova
│       ├── sound/{cues,classify} # trade-open
│       ├── trade/TradeLayer.tsx  # disparo do cue
│       ├── landAuction/LandAuctionLayer.tsx  # C5
│       ├── lab/cases.ts          # casos determinísticos novos
│       └── e2eScenario.ts        # andaimes novos
└── assets/sfx/trade-open.ogg     # asset novo

tests/            # unidade: views puras, log, efeitos, relógio do lote
e2e/              # pregao.spec.ts e responsive.spec.ts estendidos
```

**Structure Decision**: nenhuma pasta nova de topo. Os três display models entram em
`src/game/ui/panels/`, onde `playersView` e `activeHudView` já moram — a seam de "view-model puro,
testável sem React" já existe e está documentada; esta spec a povoa em vez de inventar outra.

## Complexity Tracking

Sem violações da constitution — seção intencionalmente vazia.
