# Feature Specification: Retenção leve na sala privada

**Feature Branch**: `053-retencao-leve-sala` (documentação; implementação direta em `main`)

**Created**: 2026-07-30

**Status**: Aprovada (autorização explícita do brief; implementação liberada)

**Input**: User description: "Preservar até 10 resumos entre revanches da mesma sala, derivar estatísticas e reorganizar configurações existentes como presets, sem contas, histórico global ou novas regras."

> Regra criada antes da spec: [D-067](../../docs/adr/D-067-retencao-leve-fica-na-sala-privada.md), SRS v1.29 §11.7. Esta spec operacionaliza a decisão; não cria comportamento de negócio novo.

## Clarifications

Resolvidas pelo brief, ADR e código real:

| Ambiguidade | Resolução | Fonte |
|---|---|---|
| Chave da partida | `matchGeneration`; uma entrada por geração | D-067 + 049 |
| Identidade estatística | `historyId` público, aleatório e restrito à sala; persiste no assento, mas não autentica nem cruza salas | `playerId` reordena; `uid` muda na reentrada; `reentryCode` é credencial |
| Finalização incompleta legada | Campo temporal pode ser `null`; nenhuma data é inventada para snapshot antigo | contrato do `matchSummary` |
| Ordem/limite | entradas em ordem cronológica crescente; ao exceder 10, remover as mais antigas | D-067 |
| Escrita | somente autoridade adiciona e persiste; convidados apenas recebem/leem | D-020/D-067 |
| Estatísticas | calculadas sob demanda do array; arredondamento é só apresentação | D-067 |
| Preset | objeto que resolve para `openingMode`; este continua a única fonte publicada | D-046/D-067 |
| Preferência local | usada somente ao criar uma sala nova; `enter()` jamais a aplica sobre sala publicada | D-067 |
| Superfície | painel `<details>` compacto apenas quando o lobby é de revanche (`matchGeneration > 0`) | SRS §11.7 |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rever as partidas da sala (Priority: P1)

Como integrante que voltou ao lobby para uma revanche, quero ver os resultados recentes compartilhados pelo grupo.

**Why this priority**: cria continuidade sem conta, replay ou dashboard.

**Independent Test**: finalizar uma partida, reabrir a sala e conferir uma entrada idêntica no host e no convidado.

**Acceptance Scenarios**:

1. **Given** a primeira partida finalizada, **When** a autoridade persiste o estado final, **Then** a geração aparece uma única vez com os campos autorizados.
2. **Given** uma revanche finalizada, **Then** a segunda entrada é acrescentada sem apagar a primeira.
3. **Given** 11 finalizações, **Then** permanecem somente as 10 mais recentes.
4. **Given** snapshot repetido, reload ou mensagem atrasada da mesma geração, **Then** não há duplicação nem regressão.
5. **Given** sala legada sem campo de histórico, **Then** ela abre normalmente com histórico vazio.
6. **Given** o lobby da primeira partida, **Then** o painel de retenção não transforma a tela em dashboard.

---

### User Story 2 — Comparar estatísticas daquele grupo (Priority: P2)

Como integrante da sala, quero ver um resumo derivado das partidas preservadas.

**Why this priority**: dá valor cumulativo ao histórico sem instrumentar o motor.

**Independent Test**: fornecer um histórico conhecido a um oráculo simples e comparar todos os agregados.

**Acceptance Scenarios**:

1. **Given** entradas com o mesmo `historyId`, **Then** partidas, vitórias, taxa, colocação média e melhor patrimônio são agregados como um jogador.
2. **Given** reordenação de `playerId` entre partidas ou reentrada com novo `uid`, **Then** o agrupamento continua pelo `historyId`.
3. **Given** o conjunto da sala, **Then** duração média usa somente durações conhecidas e a média de rodadas usa todas as entradas.
4. **Given** nomes/visuais mudados em snapshot compatível, **Then** a apresentação usa a identidade da entrada mais recente sem reescrever o passado.

---

### User Story 3 — Escolher um preset de configuração existente (Priority: P1)

Como host, quero selecionar um preset claro para o Ritual de Largada e reaproveitar minha última preferência numa sala nova.

**Why this priority**: reduz repetição preservando as duas regras já aprovadas.

**Independent Test**: criar salas com cada preset e provar que somente `openingMode` muda.

**Acceptance Scenarios**:

1. **Given** preset “Leilão secreto”, **When** selecionado pelo host no lobby, **Then** a configuração publicada é `sealed-bid`.
2. **Given** preset “Maior dado”, **Then** a configuração publicada é `dice-roll`.
3. **Given** convidado ou partida já iniciada, **Then** a tentativa de mudar preset não altera a sala.
4. **Given** preferência local do host, **When** uma sala nova é criada, **Then** ela pode iniciar nessa configuração.
5. **Given** entrada numa sala existente com escolha publicada diferente da preferência local, **Then** a escolha publicada vence.

---

### User Story 4 — Persistir sem vazar dados privados (Priority: P1)

Como grupo numa sala privada, quero que a memória sobreviva a reloads sem guardar segredos.

**Why this priority**: retenção só é aceitável se mantiver o contrato de privacidade e autoridade.

**Independent Test**: inspecionar o JSON persistido e tentar escrever como convidado.

**Acceptance Scenarios**:

1. **Given** uma gravação da autoridade, **Then** host e convidados convergem após reload.
2. **Given** tentativa de `write_room`/`write_snapshot` por quem não é host, **Then** a RPC rejeita.
3. **Given** o JSON do histórico, **Then** não contém mãos, cartas, negociações, log, `reentryCode`, tokens ou credenciais.
4. **Given** frontend novo antes da migration, **Then** o jogo continua persistindo pela assinatura anterior sem derrubar a partida; o histórico passa a ser durável quando a migration existir.

### Edge Cases

- Finalização recebida duas vezes com conteúdo diferente para a mesma geração: a primeira entrada aceita permanece imutável.
- Geração anterior entregue depois de uma revanche: pode acrescentar uma entrada ainda ausente, mas nunca remover/substituir as mais novas.
- Duração ausente em snapshot legado: exibida como indisponível e excluída da média temporal.
- Sala com 8 jogadores por 10 partidas: painel rola dentro do documento sem overflow horizontal.
- `localStorage` bloqueado: preset usa o default e a sala continua funcional.
- Preset lembrado inválido/antigo: normaliza para `sealed-bid`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `Room` MUST aceitar `matchHistory` compatível com salas legadas e normalizá-lo para no máximo 10 entradas válidas.
- **FR-002**: Cada assento MUST ter um `historyId` público, não credencial, estável na vida da sala e preservado em reordenação/reentrada.
- **FR-003**: A autoridade MUST criar uma entrada somente na transição real para `ended`, usando `matchGeneration` como chave idempotente.
- **FR-004**: A entrada MUST conter somente geração, fim, duração, rodadas e classificação com `historyId`, `playerId`, nome, cor, Avatar, Skin, rank, patrimônio, propriedades e rodada de eliminação.
- **FR-005**: Histórico MUST NOT conter mãos, cartas, negociações privadas, log, credenciais, códigos de reentrada ou telemetria individual.
- **FR-006**: O histórico MUST preservar no máximo as 10 gerações mais recentes e MUST sobreviver à revanche/reload.
- **FR-007**: Escrita atrasada MUST NOT regredir geração/revisão nem duplicar uma geração.
- **FR-008**: Host e convidados MUST receber o mesmo histórico público; somente host persiste.
- **FR-009**: Estatísticas MUST ser funções puras derivadas do histórico, sem contadores no `GameState`.
- **FR-010**: Estatísticas por jogador MUST incluir partidas, vitórias, taxa de vitória, colocação média e melhor patrimônio.
- **FR-011**: Estatísticas da sala MUST incluir duração média conhecida e média de rodadas.
- **FR-012**: O lobby de revanche MUST exibir histórico/estatísticas em disclosure compacto, acessível e responsivo; estado vazio discreto quando aplicável.
- **FR-013**: O produto MUST NOT mostrar o painel durante a partida nem transformar o primeiro lobby em dashboard.
- **FR-014**: Presets MUST ser objetos extensíveis que mapeiam somente configurações existentes: `sealed-bid` e `dice-roll`.
- **FR-015**: `Room.openingMode` MUST continuar a única fonte de verdade publicada; preset selecionado é derivado dela.
- **FR-016**: Somente host em `lobby` MUST alterar preset; convidado e fase iniciada MUST ser recusados.
- **FR-017**: A última escolha do host MAY ser lembrada localmente e MUST ser aplicada somente à criação de sala nova.
- **FR-018**: A migration MUST ser aditiva (`0007`), limitada, compatível com `0006` e sem editar migration aplicada.
- **FR-019**: RPCs MUST atestar autoridade, preservar fallback de deploy e expor histórico nas leituras de sala/snapshot.
- **FR-020**: Testes MUST cobrir finalização, revanche, limite, idempotência, reload, convergência, atraso, legado, privacidade, estatísticas, presets e autoridade.

### Key Entities

- **Identidade histórica do assento**: id aleatório público restrito à sala, sem poder de reentrada.
- **Entrada de histórico**: resumo imutável de uma geração finalizada.
- **Classificação histórica**: cópia mínima da classificação final ligada à identidade visual daquele momento.
- **Estatísticas da sala**: projeção efêmera calculada das entradas atuais.
- **Preset de sala**: objeto nomeado que resolve para um subconjunto de configurações existentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 10/10 repetições da mesma geração resultam em exatamente uma entrada.
- **SC-002**: Após 11 gerações, o JSON tem exatamente 10 entradas e nenhuma excede o schema permitido.
- **SC-003**: Host e convidado, após reload isolado, exibem o mesmo conjunto ordenado.
- **SC-004**: Oráculo determinístico confirma 100% dos agregados para jogadores e sala.
- **SC-005**: Inspeção automatizada do JSON não encontra nenhuma chave privada proibida.
- **SC-006**: Preset altera somente `openingMode`; memória local nunca substitui sala publicada.
- **SC-007**: Lobby com 8 jogadores/10 partidas passa teclado, axe e viewports desktop/740×360 sem overflow horizontal.

## Assumptions

- Novas partidas gravam `startedAt`/`endedAt`; `null` existe somente para compatibilidade.
- O nome e a aparência não precisam ser únicos e são preservados como fotografia de cada partida.
- Remover um convidado no lobby antes da próxima partida não apaga seus resultados anteriores.

## Fora do escopo

Conta/perfil, histórico global ou cruzado, ranking público, leaderboard, replay, log inteiro, analytics individual, matchmaking, cartas privadas, credenciais, novas regras de dinheiro/velocidade/timer/bots e estatísticas narrativas que exigem instrumentação.
