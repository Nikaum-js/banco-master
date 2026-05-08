# Feature Specification: Leilão de casas em escassez — gatilho manual + UI (M2)

**Feature Branch**: `026-leilao-casas-escassez`

**Created**: 2026-05-24

**Status**: ❌ DESCONTINUADA (2026-05-25)

> ⚠️ **Esta feature foi removida do produto.** A escassez de construção foi eliminada — casas, hotéis e arranha-céus são ilimitados (ver [D-022](../../docs/DECISIONS.md#d-022--escassez-de-construção-removida-construção-ilimitada)). Sem escassez de casas não há o que leiloar; o módulo `economy/houseAuction.ts`, o `HouseAuctionLayer` e os testes foram apagados. Um **leilão por escassez de _terrenos_** (últimos lotes livres do tabuleiro) pode ser desenhado no futuro — é outra coisa, não reaproveita esta spec. O texto abaixo fica como registro histórico.

**Input**: User description: "Leilão de casas em escassez (§5.4) como evento autônomo no estado (campo `houseAuction`), com gatilho manual (botão) e modal dedicado; fechar transfere as casas ao vencedor sem mexer no turno."

## User Scenarios & Testing *(mandatory)*

Quando o banco fica com poucas casas e mais de um jogador quer construir, o estoque vira disputa: as casas disponíveis vão a **leilão** entre os interessados (SRS §5.4). Hoje o motor tem as peças do leilão de casas, mas sem forma de acioná-lo pela tela e amarrado ao fluxo de turno (fechá-lo bagunçaria a vez). Esta feature transforma o leilão de casas num **evento próprio**, independente do turno, com um **gatilho manual** (um botão de "Leilão de casas") e um **modal** onde se dá lances e se encerra a disputa; quem vence paga o lance e leva as casas (saem do estoque do banco). O turno em andamento não é afetado.

> Nota: o **disparo automático** por demanda simultânea (vários querendo construir ao mesmo tempo) é inerentemente multiplayer e fica para o M3. Aqui o leilão é aberto manualmente.

### User Story 1 - Abrir e disputar um leilão de casas (Priority: P1) 🎯 MVP

Como jogador, abro um leilão pelas casas disponíveis no banco; os jogadores dão lances; quem oferece mais leva as casas ao encerrar.

**Why this priority**: É a feature inteira (abrir → lance → encerrar); sem ela não há leilão de casas jogável. Testável pelos reducers do evento.

**Independent Test**: Com casas no banco e ≥2 jogadores, abrir o leilão; dar lances válidos (acima do atual, dentro do caixa); encerrar e verificar que o vencedor paga e recebe as casas (estoque do banco diminui), e que o turno permanece inalterado.

**Acceptance Scenarios**:

1. **Given** o banco tem casas disponíveis e há ≥2 jogadores não-eliminados, **When** aciono "Leilão de casas", **Then** abre uma disputa pelas casas disponíveis com todos os não-eliminados como licitantes, lance inicial zero e sem maior licitante.
2. **Given** um leilão de casas aberto, **When** um jogador dá um lance maior que o atual e dentro do seu caixa, **Then** o lance atual e o maior licitante são atualizados.
3. **Given** um lance menor/igual ao atual, ou acima do caixa do licitante, **When** tento dar, **Then** o lance é rejeitado (nada muda).
4. **Given** um leilão com um maior licitante, **When** encerro, **Then** o vencedor paga o lance, recebe as casas (o estoque do banco diminui pelas casas leiloadas), e o leilão é fechado.
5. **Given** um leilão sem nenhum lance, **When** encerro, **Then** nenhuma casa sai do banco, ninguém paga, e o leilão é fechado.
6. **Given** um leilão de casas aberto ou encerrado, **When** observo o turno do jogador da vez, **Then** o estado do turno permanece **inalterado** (o leilão é um evento à parte).

---

### Edge Cases

- **Sem casas no banco**: o gatilho fica indisponível (não há o que leiloar).
- **Menos de 2 jogadores não-eliminados**: gatilho indisponível (não há disputa).
- **Single-client (demo)**: o mesmo usuário controla todos; o modal permite escolher por qual jogador dar o lance.
- **Encerrar sem lances**: as casas ficam no banco (ninguém leva).
- **Um leilão por vez**: enquanto há um leilão aberto, o gatilho fica indisponível.
- **Lance exatamente igual ao caixa**: permitido (≤ caixa); acima do caixa, rejeitado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir **abrir** um leilão de casas pelas casas disponíveis no banco, tendo como licitantes todos os jogadores não-eliminados, via um gatilho manual.
- **FR-002**: O gatilho MUST ficar disponível apenas quando o banco tem ≥ 1 casa disponível, há ≥ 2 jogadores não-eliminados e não há outro leilão de casas aberto.
- **FR-003**: O leilão de casas MUST ser um **evento próprio do estado do jogo**, independente da resolução de turno; abri-lo ou encerrá-lo **não** altera o estado do turno em andamento.
- **FR-004**: O sistema MUST permitir **dar lance** indicando o licitante e o valor; o lance só é aceito se for **maior** que o atual e **menor ou igual** ao caixa do licitante, e o licitante for participante.
- **FR-005**: Ao dar um lance válido, o sistema MUST atualizar o lance atual e o maior licitante.
- **FR-006**: O sistema MUST permitir **encerrar** o leilão; havendo maior licitante, ele paga o lance e recebe as casas leiloadas (removidas do estoque do banco); sem maior licitante, nada é transferido.
- **FR-007**: Ao encerrar, o leilão MUST ser **limpo** do estado (some), permitindo abrir outro depois.
- **FR-008**: O modal MUST exibir quantas casas estão em disputa, o lance atual e o maior licitante, e oferecer a escolha de licitante + valor (dar lance) e a ação de encerrar.
- **FR-009**: O estado do leilão (casas, lance, licitantes, maior licitante) MUST fazer parte do estado persistível do jogo (sobreviver a recarga — princípio VII).
- **FR-010**: A lógica de abrir/lance/encerrar MUST ser derivável de forma **pura** (reducers do estado), para teste automatizado sem renderizar a interface.
- **FR-011**: Todo texto visível MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Leilão de casas (evento)**: quantas casas estão em disputa, o lance atual, o maior licitante, e a lista de licitantes participantes. Vive no estado do jogo como evento próprio (no máximo um por vez), **separado** da resolução de turno. Ao encerrar, sai do estado.
- **Estoque de casas do banco** (já existente): as casas leiloadas saem dele para o vencedor; sem vencedor, permanecem. Esta feature apenas o decrementa no encerramento (a colocação física das casas em propriedades não faz parte — o motor ajusta só o estoque, como já era).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A partir do gatilho, um leilão é aberto em 1 clique com todos os não-eliminados como licitantes e o número correto de casas em disputa.
- **SC-002**: Lances inválidos (≤ atual ou > caixa) são rejeitados em 100% dos casos; lances válidos atualizam lance/licitante.
- **SC-003**: Ao encerrar com vencedor, o caixa do vencedor cai pelo lance e o estoque de casas do banco cai pelas casas leiloadas; sem vencedor, nada muda além de fechar o leilão.
- **SC-004**: Abrir/encerrar o leilão nunca altera o estado do turno (0 efeitos colaterais no turno).
- **SC-005**: Os reducers do leilão (abrir/lance/encerrar) são cobertos por testes automatizados, incluindo os casos de rejeição e de encerrar sem lance.

## Assumptions

- **Evento autônomo**: o leilão de casas passa a viver num campo próprio do estado (padrão do evento de negociação, 024), saindo da resolução de turno — onde estava como código não acionado e cujo fechamento mexeria na vez. O `house-auction` baseado em resolução é removido (era código morto/bugado) e os pontos que o referenciavam (seletor de modais, modal, testes) são ajustados.
- **Gatilho manual**: decisão registrada com o usuário — o disparo automático por demanda simultânea depende de multiplayer (M3). O botão fica no painel de jogadores.
- **Single-client**: o modal deixa escolher por qual jogador dar o lance (o usuário controla todos); em multiplayer cada cliente daria o seu.
- **Sem timer**: o leilão é encerrado manualmente (botão), para não reacoplar ao cronômetro/turno. Um fechamento automático por prazo pode vir depois.
- **Casas em disputa**: por padrão, todas as casas disponíveis do banco no momento da abertura; a colocação física das casas ganhas em propriedades fica fora (o motor só ajusta o estoque, como já era).
- **Parte testável**: os reducers no campo do leilão; o render do modal é validado no `bun run dev` (sem testes de UI no projeto).
- **Dependências**: 004 (construção / estoque do banco / `HouseAuction`), 024 (padrão de evento autônomo no estado).
