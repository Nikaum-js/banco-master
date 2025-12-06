# Feature Specification: Limpeza na eliminação (§9.4) — imunidades e efeitos

**Feature Branch**: `019-limpeza-eliminacao`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Arremate do M1: na eliminação por falência (§9.4), cancelar as imunidades de aluguel que o jogador concedeu E que recebeu, e remover os efeitos temporários que ele originou (cujo relógio de voltas morre com ele). Transferência de imunidade existente (§8.4) fica deferida."

**Depende de**: [`008`](../008-falencia-fim-jogo/spec.md) (`declareBankruptcy`/eliminação) · [`013`](../013-negociacao-troca/spec.md) (`executeTrade` concede imunidade) · [`014`](../014-imunidade-aluguel/spec.md) (`immunities`) · [`015`](../015-cartas-efeitos-temporarios/spec.md) (`tempEffects`)

> **Escopo desta spec:** o **§9.4** — ao eliminar um jogador falido, **cancelar imediatamente** as imunidades de aluguel que ele **concedeu** e que **recebeu**, e **remover** os efeitos temporários (Apagão/Greve/Boicote/Imunidade Temporária) que ele **originou** (o relógio de voltas é dele). Fecha um gap do 014/015 (a limpeza era no-op antes das cartas existirem). **Não** cobre: transferência de imunidade existente (§8.4 "transferíveis" — deferida). Fonte: [`docs/SRS.md`](../../docs/SRS.md) §9.4.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Eliminação limpa imunidades e efeitos (Priority: P1)

Como jogador, quando alguém **fale e é eliminado**, as imunidades de aluguel ligadas a ele somem (as que ele **deu** a outros e as que **recebeu**), e os efeitos temporários que ele **lançou** (Boicote/Imunidade Temporária/Apagão/Greve) são removidos — nada fica "fantasma" no tabuleiro.

**Why this priority**: gap de consistência do §9.4; sem isso, imunidades/efeitos do eliminado ficariam ativos e (no caso de efeitos por voltas) **nunca expirariam** (o relógio é o GO do eliminado, que não joga mais). MVP.

**Independent Test**: dar a um jogador imunidades (concedida/recebida) e efeitos temporários originados por ele; falir/eliminar; verificar que todos somem; imunidades/efeitos de **outros** permanecem.

**Acceptance Scenarios**:

1. **Given** o eliminado **concedeu** imunidade de aluguel em uma propriedade sua, **When** ele é eliminado, **Then** essa imunidade é **removida**.
2. **Given** o eliminado **recebeu** imunidade de aluguel (é beneficiário), **When** ele é eliminado, **Then** essa imunidade é **removida**.
3. **Given** o eliminado **originou** efeitos temporários (Boicote/Imunidade Temporária/Apagão/Greve), **When** ele é eliminado, **Then** esses efeitos são **removidos**.
4. **Given** imunidades/efeitos de **outros** jogadores (não envolvendo o eliminado), **When** a eliminação ocorre, **Then** eles **permanecem** intactos.

---

### Edge Cases

- **Identificar imunidade "concedida"**: o `Immunity` (014) passa a guardar `granterId` (quem concedeu, setado na troca) — assim §9.4 distingue concedidas (granterId) de recebidas (beneficiaryId).
- **Efeito sem relógio**: um Boicote/Imunidade Temporária originado pelo eliminado teria `ownerId` que nunca mais passa pelo GO → expiraria nunca; por isso é removido na eliminação.
- **Empréstimos**: já tratados no 008/010 (o `declareBankruptcy` remove loans do devedor/credor eliminado) — sem mudança.
- **Transferência de imunidade** (§8.4): fora de escopo (deferida).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O `Immunity` (014) MUST passar a registrar **`granterId`** (quem concedeu) — setado no `executeTrade` ao conceder; opcional para compatibilidade.
- **FR-002**: Ao eliminar um jogador em `declareBankruptcy`, o sistema MUST **remover** todas as imunidades de aluguel em que ele é **`granterId`** (concedeu) **ou** **`beneficiaryId`** (recebeu).
- **FR-003**: Na mesma eliminação, o sistema MUST **remover** todos os `tempEffects` cujo **`ownerId`** é o eliminado (Boicote/Imunidade Temporária/Apagão/Greve por ele originados).
- **FR-004**: A limpeza MUST NOT afetar imunidades/efeitos que **não** envolvem o eliminado (de outros jogadores).
- **FR-005**: A limpeza MUST ser **pura**/serializável e ocorrer atomicamente dentro do `declareBankruptcy` (junto da eliminação e do destino dos ativos).

### Key Entities *(include if feature involves data)*

- **Immunity (estendido)**: `+ granterId?: string` (quem concedeu) — habilita o §9.4 a distinguir concedidas de recebidas.
- **Sem outro estado novo.** A limpeza filtra `immunities` e `tempEffects` no `declareBankruptcy`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das imunidades concedidas **ou** recebidas pelo eliminado são removidas na eliminação.
- **SC-002**: 100% dos `tempEffects` originados pelo eliminado são removidos.
- **SC-003**: 0 imunidades/efeitos de **outros** jogadores afetados pela eliminação.
- **SC-004**: A suíte 002–018 permanece verde (fora a 1 asserção do 014 que passa a incluir `granterId`); `bun run build` verde.

## Assumptions

- **`granterId` opcional**: imunidades de aluguel só nascem via `executeTrade` (014), que passa a setar `granterId`; literais de teste sem o campo seguem válidos (opcional).
- **tempEffects do eliminado removidos** por consistência (§9.4 cita imunidades; o "etc." cobre os efeitos por voltas que ficariam órfãos do relógio).
- **Transferência de imunidade (§8.4)** permanece deferida.
