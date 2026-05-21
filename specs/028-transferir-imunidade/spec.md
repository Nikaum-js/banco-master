# Feature Specification: Transferência de imunidade existente em negociação (§8.4)

**Feature Branch**: `028-transferir-imunidade`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Transferir uma imunidade JÁ ATIVA para a outra parte numa troca (re-atribuir o beneficiário), além de conceder imunidades novas. Fecha o último gap de regra (§8.4 'imunidades são transferíveis')."

## User Scenarios & Testing *(mandatory)*

Hoje uma negociação pode **conceder** imunidades novas (um jogador isenta o outro de aluguel numa propriedade própria por N voltas), mas **não** pode **transferir** uma imunidade que o jogador **já possui**. O SRS §8.4 diz que imunidades são **transferíveis** em novas negociações: quem é beneficiário de uma imunidade ativa pode passá-la para a outra parte na troca, mantendo as voltas restantes. Esta feature fecha esse gap — o último de regra do motor.

### User Story 1 - Transferir uma imunidade que eu já tenho (Priority: P1) 🎯 MVP

Como jogador que possui uma imunidade ativa (não pago aluguel numa propriedade por X voltas), posso incluí-la numa negociação para **passá-la** ao outro jogador; ao aceitar, o outro passa a ter a imunidade (com as voltas restantes) e eu deixo de tê-la.

**Why this priority**: É a regra que falta (§8.4). Sozinha completa a negociabilidade de imunidades e é testável.

**Independent Test**: Dar ao jogador A uma imunidade ativa sobre uma propriedade; montar uma troca em que A transfere essa imunidade para B; validar que a proposta é válida e que, ao aceitar, B passa a ter a imunidade (mesmas voltas) e A não.

**Acceptance Scenarios**:

1. **Given** o jogador A é beneficiário de uma imunidade ativa sobre a propriedade X, **When** A inclui essa imunidade como transferência para B numa troca, **Then** a proposta é **válida**.
2. **Given** A **não** é beneficiário de nenhuma imunidade sobre X (ou ela não existe), **When** tenta transferir a imunidade de X, **Then** a proposta é **inválida**.
3. **Given** uma troca válida com transferência de imunidade, **When** é aceita, **Then** o beneficiário da imunidade muda de A para B, as **voltas restantes** são preservadas, B passa a não pagar aluguel em X e A volta a pagar.
4. **Given** uma transferência aceita, **When** observo a concessão de imunidades novas na mesma troca, **Then** ela continua funcionando como antes (transferir não substitui conceder).
5. **Given** uma troca com transferência, **When** é aceita, **Then** ela é registrada/anunciada como qualquer troca (histórico + log).

---

### User Story 2 - Incluir a transferência no compositor (Priority: P2)

Como jogador, no compositor de negociação vejo as imunidades que **possuo** e posso marcá-las para transferir ao outro lado.

**Why this priority**: Torna a regra acessível pela UI; depende do compositor existente. Menos crítica que a regra em si.

**Independent Test**: Com uma imunidade própria ativa, abrir o compositor e verificar que ela aparece como transferível; marcá-la inclui a transferência na proposta.

**Acceptance Scenarios**:

1. **Given** possuo imunidades ativas, **When** abro o compositor, **Then** vejo uma seção que lista minhas imunidades e permite marcá-las para transferir ao outro lado.
2. **Given** marquei uma imunidade para transferir, **When** envio a proposta, **Then** ela inclui essa transferência; o modal recebido a exibe.

---

### Edge Cases

- **Transferir imunidade que não possuo**: proposta inválida.
- **Imunidade permanente** (sem prazo): transferível também; o recebedor a mantém permanente.
- **Transferir e a propriedade muda de dono na mesma troca**: a imunidade é um direito pessoal independente do dono; a transferência re-atribui só o beneficiário (o dono atual da propriedade é irrelevante para a transferência).
- **Imunidade duplicada após transferência** (recebedor já tinha uma na mesma propriedade): inofensivo — basta uma para isentar.
- **Só entre os dois da troca**: não se transfere imunidade de/para um terceiro.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Uma proposta de troca MUST poder incluir, em cada sentido, a **transferência** de imunidades que o ofertante **já possui** (é o beneficiário), além das imunidades **novas** concedidas.
- **FR-002**: O sistema MUST validar que cada imunidade transferida corresponde a uma imunidade **ativa** cujo beneficiário é o **ofertante** daquele lado; caso contrário, a proposta é inválida.
- **FR-003**: Ao aceitar, cada transferência MUST **re-atribuir o beneficiário** da imunidade (do ofertante para o recebedor), **preservando as voltas restantes** (ou a condição permanente).
- **FR-004**: Após a transferência, o **recebedor** MUST passar a não pagar aluguel naquela propriedade e o **ofertante** MUST voltar a pagar (a imunidade é pessoal).
- **FR-005**: A transferência MUST coexistir com a **concessão** de imunidades novas na mesma troca, sem alterar o comportamento da concessão.
- **FR-006**: A regra de processamento de troca (propriedades, dinheiro, taxas, concessões) MUST permanecer **inalterada** fora do acréscimo da transferência; trocas aceitas seguem sendo registradas e anunciadas.
- **FR-007**: A transferência MUST ocorrer **apenas entre os dois jogadores** da troca (sem terceiros).
- **FR-008**: A validação e a aplicação da transferência MUST ser deriváveis de forma **pura** do estado, para teste automatizado sem interface.
- **FR-009**: (UI) O compositor de negociação MUST permitir listar as imunidades que o jogador possui e marcá-las para transferir; o resumo da proposta MUST refletir as transferências.
- **FR-010**: Todo texto visível MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Imunidade** (já existente, 014): direito pessoal de não pagar aluguel numa propriedade por N voltas ou permanente, com um beneficiário e (opcional) quem concedeu. A transferência **muda o beneficiário**, preservando as voltas e quem concedeu originalmente.
- **Proposta de troca** (já existente, 024): ganha, em cada sentido, a lista de imunidades a **transferir** (as que o ofertante já possui), separada da lista de imunidades a **conceder** (novas).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Transferir uma imunidade válida muda o beneficiário em 100% dos casos, preservando as voltas restantes; o recebedor fica isento e o ofertante volta a pagar.
- **SC-002**: Propostas que tentam transferir uma imunidade que o ofertante não possui são rejeitadas em 100% dos casos.
- **SC-003**: Conceder imunidades novas continua idêntico ao comportamento anterior (nenhuma regressão).
- **SC-004**: Trocas com transferência são registradas/anunciadas como qualquer outra troca aceita.
- **SC-005**: Validação e aplicação da transferência são cobertas por testes automatizados (válida/inválida; re-atribuição com voltas preservadas; isenção troca de lado), e a suíte de troca/imunidade existente segue verde.

## Assumptions

- **Reúso do modelo de imunidade (014/024)**: a imunidade tem beneficiário, propriedade, voltas e quem concedeu; transferir muda só o beneficiário (preserva voltas e quem concedeu). A concessão de imunidades novas não muda.
- **Identificação por propriedade**: a imunidade transferida é identificada pela propriedade da qual o ofertante é beneficiário; eventual duplicidade no recebedor é inofensiva.
- **Parte testável**: validação + aplicação da transferência no processamento da troca; a UI do compositor é validada no `bun run dev` (sem testes de UI no projeto).
- **Fora de escopo**: transferir imunidade de/para terceiros; fundir imunidades duplicadas; mudar a regra de concessão de imunidades novas.
- **Dependências**: 014 (imunidades), 024 (negociação/troca/compositor), 019 (limpeza §9.4 — preservar quem concedeu na transferência).
