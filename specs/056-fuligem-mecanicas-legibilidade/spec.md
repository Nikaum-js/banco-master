# Feature Specification: Fuligem — mecânicas próprias e legibilidade

**Feature Branch**: `main`

**Created**: 2026-07-30

**Status**: Aprovada (brief explícito autorizou implementação, commit, push e acompanhamento da CI)

**Input**: “Minas não pagam aluguel; são apenas o efeito positivo de quem comprou. Remover
as linhas e nomes no meio do tabuleiro. Como Fuligem tem menos casas que Atlas, cada casa
deve ter mais espaço e os nomes grandes precisam aparecer. No leilão, não desfocar os
painéis laterais porque o caixa dos adversários informa o lance estratégico.”

> Regras criadas antes da spec: [D-070](../../docs/adr/D-070-fuligem-tem-topologia-e-regras-proprias.md),
> [D-071](../../docs/adr/D-071-minas-sao-ativos-passivos-sem-aluguel.md),
> [D-072](../../docs/adr/D-072-taxa-de-fumaca-sai-da-fuligem.md) e SRS v1.32
> (§2.8, §12.1–12.3). Esta spec operacionaliza essas decisões.

## Clarifications

| Ambiguidade | Resolução | Fonte |
|---|---|---|
| “Minas não pagam aluguel” impede compra/leilão? | Não. Mina continua título comprável, leiloável, negociável e hipotecável; somente a renda ao pousar é zero | D-071 |
| Quais bônus permanecem? | Ferro −25% em construções; Carvão +50% nas Ferrovias; Estanho −15% em impostos/aluguéis pagos; Cobre +25% em propriedades com qualquer construção | D-071 |
| A Fuligem cobra Taxa de Fumaça ao construir? | Não. Construções pagam somente seu custo normal e não alimentam a Sorte Grande | D-072 |
| O que remover do miolo? | Os quatro nomes de região e suas linhas/divisórias; dados, diário, Sorte Grande e dívida permanecem | brief + D-070 |
| Como “aumentar” as casas? | A faixa periférica da topologia Fuligem ganha mais profundidade e os textos usam o nome completo; o Atlas permanece sem mudança | brief + D-070 |
| Modal de leilão pode deixar o fundo clicável? | Não. Mantém foco e bloqueio de interação, mas sem blur/véu sobre os saldos laterais | SRS §12.2 |
| Regra que abre leilão ao recusar compra | Permanece exatamente como está | brief |

## User Scenarios & Testing

### User Story 1 — Mina vale pelo bônus, não pelo pouso (Priority: P1)

Ao comprar uma Mina, o jogador monta sua carteira pelo bônus daquele metal. Quando outro
jogador para nela, nenhum caixa muda e o turno segue normalmente.

**Independent Test**: estado com Mina de outro jogador; resolver a casa e provar caixa
inalterado, nenhuma dívida e nenhum evento de aluguel. Hipotecar a Mina desliga o bônus.

**Acceptance Scenarios**:

1. **Given** uma Mina livre, **When** o jogador compra ou recusa, **Then** compra/leilão
   continuam disponíveis como em outro título.
2. **Given** uma Mina alheia não hipotecada, **When** o jogador pousa nela, **Then** nenhum
   jogador paga ou recebe dinheiro e a resolução termina.
3. **Given** duas ou quatro Minas do mesmo dono, **When** alguém pousa em qualquer uma,
   **Then** não existe escada de aluguel.
4. **Given** uma Mina não hipotecada, **When** o motor calcula o efeito do metal, **Then**
   aplica somente o bônus documentado.
5. **Given** a mesma Mina hipotecada, **When** o motor calcula o efeito, **Then** não aplica
   bônus.

---

### User Story 2 — Tabuleiro Fuligem aproveita as 40 casas (Priority: P1)

O jogador lê nomes completos das propriedades e títulos no anel da Fuligem. O miolo não
tem linhas ou nomes geográficos competindo com a arena.

**Independent Test**: renderizar Fuligem em 1488×1488 e nas viewports obrigatórias; provar
ausência das zonas/divisórias, faixa periférica maior que a do Atlas e nomes completos sem
truncamento programático.

**Acceptance Scenarios**:

1. **Given** o mapa Fuligem, **When** o tabuleiro renderiza, **Then** cada lado tem 9 casas
   entre cantos e a faixa periférica usa mais área que no Atlas.
2. **Given** propriedades como “Barro Preto” e “Treze de Maio”, **When** renderizadas,
   **Then** o texto visível usa o nome completo e pode quebrar em linhas — em **até duas**.
   A terceira linha é falha, e o conserto é no DADO, não no layout: o teto é por PALAVRA
   (7 letras, medido contra a largura da casa), não por nome, então nome de duas ou três
   palavras curtas é válido (ver `fuligemBoard.ts`). Truncar programaticamente é proibido.
3. **Given** o miolo da Fuligem, **When** renderizado, **Then** não contém os nomes das
   antigas zonas nem linhas divisórias associadas.
4. **Given** o mapa Atlas, **When** renderizado, **Then** sua topologia e seus rótulos
   permanecem inalterados.

---

### User Story 3 — Leilão mantém caixa dos rivais legível (Priority: P1)

Durante o leilão, o jogador consulta o saldo de todos antes de dar um lance, sem perder o
foco acessível do diálogo nem conseguir acionar o tabuleiro ao fundo.

**Independent Test**: abrir um leilão, verificar overlay transparente/sem backdrop blur,
painéis de jogadores visíveis e foco contido no diálogo.

**Acceptance Scenarios**:

1. **Given** um leilão aberto, **When** a camada modal aparece, **Then** não aplica desfoque
   nem véu opaco sobre os painéis de jogadores.
2. **Given** o mesmo leilão, **When** o usuário navega por teclado, **Then** o foco permanece
   no diálogo e comandos do tabuleiro ao fundo não são acionados.
3. **Given** qualquer outro modal decisório, **When** aberto, **Then** conserva o overlay
   padrão existente.

## Requirements

- **FR-001**: `rentDue` MUST retornar zero para Mina, independentemente do número de Minas
  possuídas ou do resultado dos dados.
- **FR-002**: pousar em Mina alheia MUST encerrar a resolução sem transferência, dívida ou
  log de aluguel.
- **FR-003**: Mina MUST continuar comprável, leiloável, negociável e hipotecável; hipoteca
  MUST desativar o bônus.
- **FR-004**: a constante, função, simulação e apresentação da escada de aluguel de Minas
  MUST ser removidas.
- **FR-005**: a escritura de Mina MUST apresentar bônus, preço, hipoteca, ausência de
  construções e ausência de aluguel.
- **FR-006**: os quatro bônus MUST corresponder exatamente à D-071 e compor com as regras
  existentes sem atuar quando a Mina estiver hipotecada.
- **FR-007**: a topologia Fuligem MUST continuar com 40 casas e aumentar a profundidade da
  faixa periférica sem alterar o Atlas.
- **FR-008**: células Fuligem MUST renderizar `square.name` completo para títulos e permitir
  quebra de linha; `short` pode continuar disponível fora do anel.
- **FR-009**: nomes de zona, linhas e seus estilos MUST ser removidos do tabuleiro e do
  catálogo.
- **FR-010**: o leilão MUST usar overlay sem blur/véu, preservando semântica modal, trap de
  foco e bloqueio de interação.
- **FR-011**: alterações MUST ter testes de motor, apresentação, topologia e modal; o fluxo
  visual MUST ser verificado com screenshot real.
- **FR-012**: a regra existente que abre leilão ao recusar compra MUST NOT mudar.
- **FR-013**: construir Oficina, Fábrica, Complexo de Fábricas ou Torre de Ferro na Fuligem
  MUST debitar somente o custo normal da construção e MUST NOT alimentar a Sorte Grande.

## Key Entities

- **MineSquare**: título sem renda direta, identificado por metal e com bônus passivo.
- **BoardTopology**: geometria por mapa; Fuligem 40 (`0/10/20/30`), Atlas 48
  (`0/12/24/36`).
- **Overlay veil**: variante visual da casca modal; leilão usa camada transparente e os
  demais fluxos usam a vinheta padrão.

## Success Criteria

- **SC-001**: testes provam zero transferência/dívida/log em todo pouso numa Mina alheia e
  os quatro bônus corretos, inclusive desligamento por hipoteca.
- **SC-002**: nenhuma referência funcional a `MINE_RENT`, `rentMine`, “Aluguel por minas”
  ou zonas do tabuleiro permanece.
- **SC-003**: screenshot da Fuligem mostra nomes completos e anel visualmente mais profundo,
  sem nomes/linhas no miolo.
- **SC-004**: screenshot do leilão mostra todos os saldos laterais legíveis, sem blur.
- **SC-005**: `bun run lint`, `bun run typecheck`, testes relevantes, suíte Vitest e
  `bun run build` passam; commit enviado e CI concluída com sucesso.

## Assumptions

- O preço `R$ 220`, hipoteca `R$ 110` e os quatro bônus já aprovados não são
  rebalanceados nesta feature.
- O ajuste de área é específico à Fuligem; não reforma o layout central ou o Atlas.
- “Ver o dinheiro do inimigo” refere-se aos painéis públicos de jogadores já existentes;
  nenhuma informação privada nova é exposta.
