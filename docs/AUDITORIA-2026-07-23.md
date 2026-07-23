# Auditoria ponta a ponta — Banco Master (2026-07-23)

> Diagnóstico apenas — nenhum código foi alterado. Toda afirmação está ancorada em
> `arquivo:linha` lido na data da auditoria. Suíte verificada antes: **353 testes / 46
> arquivos, todos passando** (`bunx vitest run`, ~63s). `tsc -b` limpo. Lint: **36 erros
> + 2 warnings** pré-existentes.

---

## Fase 1 — Mapeamento

### Stack e como roda

- **Runtime:** React 19 + Vite 8 (rolldown + `babel-plugin-react-compiler`) + TypeScript 6 + Tailwind 4 + Zustand 5 + `motion`. Gerenciador: **bun** (`bun.lock`).
- **Scripts** (`package.json`): `dev`, `build` (`tsc -b && vite build`), `lint`, `test` (vitest), `sim:replay`, `sim:batch`, `test:e2e` (Playwright).
- **Entrypoint:** `index.html` → `src/main.tsx` → `src/App.tsx`. Não há tela inicial — o tabuleiro É a home (`src/App.tsx:14`); `?players=2|3|6` escolhe a contagem (`src/game/store.ts:184-189`); `?sons` abre o SoundBoard (`src/App.tsx:21`).
- **Camadas:** engine puro em `src/game/{turn,economy,cards,balancing,falencia,emprestimos}`; UI em `src/game/ui` + `src/boards`; valores econômicos centralizados em `src/game/theme.ts` + `src/lib/boardData.ts` (48 casas, 10 grupos).
- **Testes:** unit/integração em `tests/game`, simulação headless com invariantes em `tests/sim` (RNG seedado mulberry32, relógio lógico), smoke E2E 2/3/6p em `e2e/`. Relatórios de lote em `reports/`.
- **Multiplayer:** Supabase **ainda não entrou** — nenhuma dependência nem código (só o TODO do sino your-turn em `SoundLayer.tsx`). O app é single-client hotseat de fato.

### O que NÃO consegui inferir (confirmar com o Nikolas)

1. **GO Progressivo:** `docs/SRS.md:844` (§13.5) ainda especifica $100–$400 por ranking, mas o código paga **flat $200** (`src/game/balancing/balancing.ts:11` — "substitui o GO Progressivo por revisão de regra"). Não achei ADR dessa revisão em DECISIONS — o SRS está desatualizado ou o código diverge da verdade de negócio?
2. **Speed Die suspenso** (`theme.ts:56`, D-003): é suspensão temporária a recalibrar ou remoção de fato? Afeta o ritmo (48 casas com 2 dados = voltas ~40% mais longas que o Monopoly clássico de 40 casas).
3. Se os **31→36 erros de lint** pré-existentes devem ser zerados agora ou junto da spec 036.
4. Prioridade do **lobby (M3/D-025)** vs. Supabase — vários gaps de UX abaixo dependem dessa ordem.
5. Profundidade da auditoria de **cartas** (`src/game/cards/*`): não li os efeitos um a um; a cobertura de sim mostra todas exercitadas, mas não auditei regra por regra.

---

## Fase 2 — Auditoria por dimensão

### A. Arquitetura & código

**Veredicto: núcleo genuinamente bom; problemas concentrados na casca.** Reducers puros `(state, ctx) → state` com `structuredClone` na borda (`turnMachine.ts:25-27`), estado 100% serializável, zero mutação direta de estado do engine na UI (verificado por grep), view-models puros (`deedView.ts`, `activeModal.ts`, `handView.ts`, `tradesView.ts`). A melhor prova da separação: a simulação dirige o motor real sem React/Zustand.

| # | Achado | Evidência | Por quê importa |
|---|---|---|---|
| A1 | **Ciclo de import real** `boards/shared.tsx ↔ game/ui/*` | `shared.tsx:12-17` importa de `game/ui/**`; `TradeLayer.tsx:14`, `ModalLayer.tsx:14`, `GameHUD.tsx:17`, `LiveTokens.tsx:12` importam de volta (`GROUP_COLOR`, `PlayerFace`, `computeRents`…) | Ciclo ESM funciona "por sorte" da ordem de avaliação; refactor pode gerar `undefined` em runtime. Extrair `src/game/ui/kit/` com os primitivos visuais |
| A2 | **God file:** `shared.tsx` com 3.261 linhas e ~7 responsabilidades (glifos SVG, geometria, tokens, painéis, DiceArena, log, popovers, mocks) | `shared.tsx` inteiro; 12 dos 36 erros de lint são dele (`react-refresh/only-export-components`) | HMR degradado, revisão impraticável, hub dos dois lados do ciclo A1 |
| A3 | **Dead code com valores divergentes:** `HOUSE_COST` morto em `shared.tsx:424` diz `brown: 50` vs `THEME.HOUSE_COST.brown: 40` (`theme.ts:16`); + `MOCK_PLAYERS`/`LOCAL_PLAYER_NAME` (1073-1087), `PlayerTokens` (1000-1049), `LotteryCard` (2432), `CenterPlate` (2646), `GROUP_BG` (395) | grep: zero usos | Armadilha pronta para importar a constante errada; segundo tipo `Player` homônimo (`shared.tsx:1056`) |
| A4 | **Log stringly-typed é o "event bus":** som classifica por substring (`classify.ts:72-83` — `w.startsWith('comprou ')`) e a UI colore por regex (`shared.tsx:2293-2296`) sobre frases emitidas pelo motor (`log.ts:8`) | — | Mudar uma palavra de log muda áudio e cor silenciosamente; bloqueia i18n e a explicação de aluguel (D2) |
| A5 | **Duplicações UI vs THEME:** multa de prisão hard-coded (`shared.tsx:1699,1703` vs `theme.ts:46`); tabela de aluguel de aeroporto/utilidade re-escrita (`ModalLayer.tsx:405-417` vs `theme.ts:37-38`); fórmula de desconto espelhada (`shared.tsx:1599` vs `purchase.ts:23`); `sideOf` implementado 2× (`turnMachine.ts:69`, `shared.tsx:505`) | — | Recalibrar o tema deixa UI e motor divergentes sem erro de compilação |
| A6 | **Ponto de composição definido 2×:** `driver.ts:47-61` re-implementa `defaultPorts` (`store.ts:41-52`) e a resolve chain (`store.ts:234` vs `driver.ts:74`); importar `createSeedState` do store instancia o Zustand + `Math.random` como efeito colateral em teste | `tests/sim/engine/driver.ts:6,47-61` | Porta nova adicionada só no store ⇒ a simulação valida um jogo diferente do produto. Extrair `src/game/setup.ts` puro |
| A7 | **Timers singleton fora do estado** (`auctionTimer`/`landTimer`, `store.ts:164,173`) | — | OK single-client; quebra com Supabase/multissessão — deadline já é serializável, só o handle é global |
| A8 | PT/EN misturados sistematicamente (`TurnState` PT em `turn/types.ts:18-23` vs `mayRollAgain`; `falencia/` vs `purchase.ts`) | — | Não quebra nada; decidir a convenção e registrar, sem renomeio em massa agora |

### B. Game design & balanceamento

**A economia fecha na simulação:** 100/100 partidas terminam por falência antes do cap — 2p em ~12–35 rodadas, 6p em ~25–61 (`reports/headless-*.json` → `roundsHistogram`), duração saudável para o gênero.

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| B1 | **Catch-up principal foi removido sem rastro no SRS:** GO Progressivo ($100–$400 por ranking, `SRS.md:844`) virou flat $200 (`balancing.ts:11`). Sobram como catch-up: Tax Man (atinge mais quem tem mais, `taxMan.ts:43-44`) e Free Parking aleatório | `balancing.ts:8-13` | O princípio IV (catch-up discreto) ficou apoiado só em RNG; e a "verdade absoluta" (princípio I) está desatualizada |
| B2 | **Speed Die suspenso deixa 3 mecânicas mortas em produção:** `onibus`/`triple`/`mr-banco` (`turnMachine.ts:169-182`) e os choosers só existem via testes; com 2 dados em 48 casas, a volta média é ~14 turnos-jogador | `theme.ts:53-56` | Ritmo mais lento que o clássico; decidir substituto de ritmo ou recalibrar |
| B3 | **Free Parking é injeção líquida:** pote semeado E reabastecido com $500 a cada coleta (`balancing.ts:27`), e impostos/multas vão ao pote em vez de sumir (`resolution.ts:69`, `turnMachine.ts:289`) — não são sink. Sinks reais: compras, construção, deshipoteca (+10%), Hangar, Tax Man | `balancing.ts:16-28` | Inflação estrutural; hoje compensada pelos sinks — mas é o primeiro knob a olhar se partidas arrastarem com humanos |
| B4 | **A simulação não mede o que importa para balanceamento:** o report conta ocorrências de mecanismo e rounds, mas **não registra vencedor, curva de patrimônio nem estratégia** (`tests/sim/engine/report.ts`) | `reports/headless-2p.md` | Impossível afirmar/refutar dominant strategy com evidência. A hipótese a testar: construção com país parcial (D-026) + tier fixo de casa (`theme.ts:15-19`) tem ROI desproporcional em orange/red com 1 cidade |
| B5 | **Empréstimos (§15) nunca ocorrem no sim:** `grant-loan`, `pay-off-loan`, `loan-interest-on-go` com 0 ocorrências — gap admitido no próprio report | `reports/headless-*.md` (rodapé) | Mecânica inteira sem validação empírica — e é justamente onde achei o bug C1 |
| B6 | **Leitura de balanceamento distorcida pelo agente:** 37k hipotecas e 14k trades aceitos por 100 jogos 2p; `rent-zero` (10.676) supera `rent` pago (3.307) | `reports/headless-2p.md` | O agente randômico faz churn não-humano; conclusões de economia via sim precisam de um agente menos caótico ou métricas por política |

**Positivo:** Tax Man como sink discreto bem implementado (cobra até o jogador da vez, dinheiro removido — `taxMan.ts:43-44`); pregão de escassez com trava de episódio e solvência por caixa comprometido (`landAuction.ts:37-44,91`) é um design maduro.

### C. Regras & correção

| Sev | Achado | Evidência | Cenário de falha |
|---|---|---|---|
| **ALTA** | **Dívida de juros é sobrescrita pela resolução da casa.** `chargeLoanInterest` grava `state.resolution = {kind:'debt'}` durante o `advance` (via `afterPassGo`); depois `resolvePending` roda `economyResolve`, que sobrescreve com `purchase` ou outra dívida | `emprestimos.ts:123` vs `resolveRentable.ts:18,47` | Devedor com empréstimo passa pelo GO sem caixa para os juros e cai em terreno sem dono: o credor recebe só o parcial e o `resto` da dívida **desaparece**. Sem teste cobrindo (B5: sim nunca exercita empréstimo) |
| MÉDIA | **`jailDecision('pay')` debita sem checar caixa** — `player.cash -= JAIL_FINE` direto; o único guard é da UI (`shared.tsx:1699`). Contraste: a 3ª tentativa usa `Math.min` (`turnMachine.ts:316`) | `turnMachine.ts:288` | Qualquer chamada fora da UI (sim, futuro multiplayer, console) gera caixa negativo sem abrir dívida |
| MÉDIA | **Asset dumping pré-falência:** trade não é bloqueado enquanto há `resolution: 'debt'` (`validateTrade` não olha `state.resolution`; store expõe `executeTrade` "não gated por turno") | `trade.ts:81-98`, `store.ts:295` | Devedor insolvente doa as propriedades por $0 a um aliado antes de `declareBankruptcy`, esvaziando a herança do credor (`falencia.ts:76-91`). Em multiplayer é griefing direto |
| BAIXA | Falência não limpa a **mão de cartas** nem `pendingTrade` do eliminado (limpa loans/immunities/tempEffects) | `falencia.ts:100-104` | Mitigado: eliminado nunca mais age e `acceptTrade` revalida (`trade.ts:87`). Ainda assim estado "fantasma" |
| BAIXA | Leilão comum: todos passarem **não fecha** o leilão (só o timer fecha); e o `highBidder` que passa continua vencedor | `auction.ts:34-39` | 10s de espera morta; passivo→ativo esquisito. O pregão de escassez não tem esse problema |
| INFO | Vencedor de leilão paga `min(lance, caixa)` — deliberado (comentário FR-004a) em ambos os leilões | `auction.ts:50`, `landAuction.ts:111` | Aceitável hoje; em multiplayer permite lance alto de má-fé + esvaziar o caixa antes do fecho. Revisitar no M3 |
| INFO | Fim de jogo só por "resta 1" (`falencia.ts:41`) — sem empate, sem limite de tempo/rodadas | `falencia.ts:40-42` | Sim usa `roundCap` externo; partida humana pode não convergir. Decisão de produto pendente |

**Sólido (verificado):** validação de trade cobre posse, construção, hipoteca (taxa de 10%), caixa final ≥ 0 e imunidades (`trade.ts:81-98`); guards de hipoteca/construção consistentes (invariante `hotel ⊂ hotel2 ⊂ skyscraper` se mantém em `buildHouse`/`sellBuilding`, então `groupHasConstruction` em `mortgage.ts:30-38` não tem furo); prisão (3 tentativas, dupla sai sem re-roll), triple não conta como dupla (`turnMachine.ts:42-44`), GO em dobro ao parar exato — tudo com teste.

### D. UX/UI & produto

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| D1 | **Sem lobby/nomes** — jogadores são `p1..pN` por query string; a tela de vitória celebra "p1" em dourado 64px | `store.ts:184-189`, `GameHUD.tsx:194`, `shared.tsx:1643-1645` | O momento de maior emoção do jogo esvaziado; pré-requisito até para demo |
| D2 | **Aluguel não explica o cálculo** — log diz "pagou $X" sem "hotel, país completo, ×posse"; com D-026 o valor é imprevisível para o jogador | `resolveRentable.ts:53`, `log.ts:6-11` (50 entradas, sem timestamp) | O "porquê paguei 340?" fica sem resposta; depende de A4 (log tipado) |
| D3 | **Leilão comum quebrado como produto:** só o jogador ativo dá lance; `passBid` existe no store mas **não tem botão** — recusou a compra, leiloa contra ninguém e arremata por $2 | `ModalLayer.tsx:517`, `store.ts:135` (órfão); contraste: seletor "Lance por:" do pregão em `LandAuctionLayer.tsx:217-230` | Mecânica central do gênero inoperante no hotseat; padrão certo já existe no pregão |
| D4 | **F5 = partida perdida** — nada do `GameState` persiste (só prefs de áudio, `sound/prefs.ts:16-32`); estado é 100% serializável, snapshot seria trivial | grep: zero `localStorage` de jogo | Partida de 1h destruída por refresh acidental |
| D5 | **Acessibilidade:** casas são `div onClick` sem teclado (`Board01Classic.tsx:94-107`); zero `role="dialog"`/`aria-live` em `src/`; sem `prefers-reduced-motion` (confete `repeat: Infinity`, `NoticeLayer.tsx:39`); fontes de 8–9px recorrentes (`ModalLayer.tsx:72,173`, `TradeLayer.tsx:139,203`); posse indicada só por cor com pares problemáticos (teal/cyan, `shared.tsx:1354`) | — | Hipotecar para pagar dívida é mouse-only; daltônicos não distinguem donos |
| D6 | Inconsistência de moeda "$" vs "R$" (`shared.tsx:1703`, `LiveTokens.tsx:132` vs resto); sem confirmação em "Declarar falência" (`GameHUD.tsx:397`); pausa existe no motor sem botão na UI; bandeiras dependem de `flagcdn.com` sem fallback | — | Polimento e robustez offline |

**Positivo (reconhecer):** sound design excepcional para o estágio (~40 cues semânticos, 3 canais com idempotência, unlock de autoplay, SoundBoard de auditoria via `?sons`); card de dívida exemplar (credor↔devedor, barra de cobertura, tabuleiro clicável por trás — `GameHUD.tsx:269-412`); TradeLayer com re-validação "estado mudou → recuse" (`TradeLayer.tsx:420,444`); movimento casa-a-casa com tick sonoro por passo.

### E. Qualidade & testes

| # | Achado | Evidência |
|---|---|---|
| E1 | **Sem CI** — não existe `.github/` | verificado |
| E2 | **Lint com 36 erros** (12 em `shared.tsx`, resto majoritariamente `tests/sim`); inclui 1 **falso positivo estrutural**: `useBusTicket` do engine tratado como hook React (`react-hooks/rules-of-hooks` em `driver.ts:110`) — renomear para `spendBusTicket` resolve na raiz | `bun run lint` |
| E3 | **Sem coverage configurado** (`vitest.config.ts` não tem `coverage`); UI tem ~0 testes de componente — os 353 testes são engine/view-models puros; `shared.tsx` (3.261 linhas) sem nenhum teste | `vitest.config.ts:5-15` |
| E4 | **E2E é só smoke** de erro de runtime (10+ rodadas com roteiro fixo) — não assere regra nenhuma | `e2e/2players.spec.ts:10-21` |
| E5 | **Simulação é o ponto forte real do projeto:** conservação de dinheiro com oráculo independente (`conservation.ts:19,24` recomputa pelos mesmos predicados), determinismo por seed, probes de ação inválida, invariantes por tick — 1.500 jogos ok em lote (`reports/manual-check.json`) | `tests/sim/engine/*` |
| E6 | Gaps do sim já citados: empréstimos e `rent-immune` nunca exercitados (B5); e o driver duplica a composição do jogo (A6) | reports + `driver.ts:47-74` |

### F. Performance & robustez

| # | Achado | Evidência |
|---|---|---|
| F1 | **Sem ErrorBoundary** — exceção em qualquer render = tela branca, partida perdida (agrava D4) | grep vazio em `src/` |
| F2 | Timers/listeners majoritariamente com cleanup correto (13 sites, 10 cleanups; sound engine usa `once: true` — `engine.ts:87-89`); sem leak evidente | verificado por grep |
| F3 | Seletores Zustand granulares na maioria (34 seletores só em `shared.tsx`) — bom; exceção: `playersView(useGameStore((s) => s.game))` re-deriva o painel inteiro a cada mudança de estado | `shared.tsx:1375` |
| F4 | Engine de áudio robusto: buffers cacheados por Promise, throttle 70ms por cue, nunca lança | `engine.ts:40-74` |
| F5 | `structuredClone` por comando é adequado ao tamanho do estado (sim roda 100 jogos 2p em 32s) | `reports/headless-2p.json` |
| F6 | Dependência de runtime externa: `flagcdn.com` (8 usos) — offline/CDN fora degrada o tabuleiro sem fallback | `shared.tsx` FlagAvatar, `ModalLayer.tsx:307,435` |

### G. Segurança & dados

- **Hoje a superfície é mínima** (sem backend, sem dados sensíveis, sem input de texto livre).
- **Risco estrutural para o M3:** todo o engine é client-authoritative e a identidade é uma string `playerId` passada pelo chamador (`placeBid(playerId, …)` — `store.ts:262`; `executeTrade` sem noção de "quem sou eu"). Se o Supabase entrar como sync de estado cliente-autoritativo, **qualquer cliente pode agir pelos outros**. Decidir autoridade (host-authoritative ou validação server-side via RLS/functions) ANTES de desenhar a spec de multiplayer — o formato atual dos comandos vai influenciar essa spec.
- `bun audit`: 1 advisory **low** — `@babel/core <=7.29.0` (Arbitrary File Read via `sourceMappingURL`, GHSA-4x5r-pxfx-6jf8), só toolchain de build, não runtime. `bun update @babel/core` resolve.
- `flagcdn.com` também é vazamento passivo de IP dos jogadores para terceiro (menor, mas vale citar na era Supabase).

---

## Fase 3 — Priorização (impacto × esforço)

Tamanhos: **P** ≤ meio dia · **M** 1–3 dias · **G** ≥ 1 semana.

| # | Problema | Evidência | Recomendação | Tam. |
|---|---|---|---|---|
| 1 | Dívida de juros sobrescrita pela resolução da casa | `emprestimos.ts:123` vs `resolveRentable.ts:18,47` | Enfileirar/compor resoluções (ou resolver juros como dívida antes de abrir purchase); + teste que hoje não existe | P |
| 2 | `jailDecision('pay')` permite caixa negativo | `turnMachine.ts:288` | Guard no engine (recusar ou abrir dívida), igual à 3ª tentativa | P |
| 3 | Dead code com valores divergentes + mocks | `shared.tsx:424` vs `theme.ts:16` | Deletar `HOUSE_COST`, `MOCK_*`, `PlayerTokens`, `LotteryCard`, `CenterPlate` | P |
| 4 | Sem CI + 36 erros de lint | `.github/` ausente | Workflow GitHub Actions (lint + tsc + vitest + sim curto); renomear `useBusTicket`→`spendBusTicket`; zerar lint | P/M |
| 5 | `bun audit` low no `@babel/core` | GHSA-4x5r-pxfx-6jf8 | `bun update @babel/core` | P |
| 6 | ErrorBoundary inexistente | grep vazio | Boundary no `App` com "recarregar mantendo partida" (casa com o item 8) | P |
| 7 | Trade livre durante dívida (asset dumping) | `trade.ts:81-98` | Bloquear propostas/execução de trade de quem está com `resolution: 'debt'` (ou decidir e documentar como regra) | P |
| 8 | F5 mata a partida | zero persist | Snapshot do `GameState` (já serializável) em `localStorage` a cada `set`; hidratar no boot | M |
| 9 | Leilão comum sem multi-licitante nem "passar" | `ModalLayer.tsx:517`, `store.ts:135` | Copiar o padrão do pregão (`LandAuctionLayer.tsx:217-230`); fechar quando todos passam | M |
| 10 | Log stringly-typed como event bus | `classify.ts:72-83`, `shared.tsx:2293` | `LogEntry { kind, who, amount, what }`; frase PT vira apresentação — destrava som robusto, cor, i18n **e** a explicação de aluguel (D2) | M |
| 11 | Lobby mínimo + `displayName` | `store.ts:184-189`, `GameHUD.tsx:194` | Contagem + nomes + cores antes do Supabase; nunca mais renderizar `p.id` | M |
| 12 | Sim não mede vencedor/curvas | `report.ts` | Registrar vencedor, patrimônio por rodada e política do agente; só então afirmar algo sobre dominant strategy (D-026) | M |
| 13 | Composição do jogo definida 2× | `store.ts:41-52` vs `driver.ts:47-61` | Extrair `src/game/setup.ts` puro consumido por ambos | P |
| 14 | SRS §13.5 divergente do código (GO) | `SRS.md:844` vs `balancing.ts:11` | Atualizar SRS + ADR, ou restaurar o progressivo (decisão de design, não de código) | P |
| 15 | Ciclo `shared.tsx ↔ game/ui` + god file | `shared.tsx:12-17` | Extrair kit de primitivos; fatiar `shared.tsx` por responsabilidade | G |
| 16 | Acessibilidade base | `Board01Classic.tsx:94-107` | `role`/teclado nas casas, `role="dialog"`, `aria-live` no log, `prefers-reduced-motion`, mínimo 11px | M |
| 17 | Autoridade de estado p/ multiplayer | `store.ts:262` | Decidir client vs server authority ANTES da spec Supabase | (decisão) |

### Se só puder fazer três coisas

1. **Blindar o engine: itens 1, 2 e 7 + CI (item 4).** São os únicos bugs que corrompem estado de verdade, todos P, e o CI impede que voltem. O motor é o ativo mais valioso do projeto — está a ~2 dias de ficar sem furo conhecido.
2. **Log tipado (item 10).** É a alavanca estrutural com melhor custo-benefício: destrava de uma vez a explicação de aluguel (maior gap de clareza da UX), robustez do som, cor do histórico, i18n futura e telemetria melhor da simulação.
3. **Pacote "mostrável": lobby mínimo + persistência + leilão multi-licitante (itens 8, 9, 11).** É o que separa "protótipo impressionante" de "jogo que alguém joga até o fim e pede revanche" — e tudo nele é pré-requisito direto do multiplayer, então nada é retrabalho.

---

*Auditoria executada com leitura direta das fontes; dimensões A e D com apoio de agentes de análise, dimensões B, C, E, F, G verificadas em primeira mão. Nenhuma linha de código foi modificada.*
