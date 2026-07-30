# Feature Specification: Convite por QR Code e compartilhamento

**Feature Branch**: `052-convite-qr-compartilhamento` (documentação; implementação direta em `main`)

**Created**: 2026-07-30

**Status**: Aprovada (autorização explícita do brief; implementação liberada)

**Input**: User description: "Adicionar ao lobby compartilhamento nativo, fallback por cópia/WhatsApp e QR Code local para o link canônico privado da sala, sem alterar entrada, autenticação ou segurança."

> Conformidade: a feature melhora apenas a distribuição da credencial de entrada já existente. Não muda regra de jogo, economia, autoridade ou privacidade da sala.

## Clarifications

Resolvidas pelo brief e pelo código atual, sem rodada interativa:

| Ambiguidade | Resolução | Fonte |
|---|---|---|
| URL compartilhada | Usar exatamente `roomLink(room.id)`, hoje `/play?room=<id>` | brief + `src/net/session.ts` |
| Compartilhamento principal | Web Share API quando disponível, com título, texto curto e URL em campos separados | brief |
| Cancelamento | `AbortError`/cancelamento do share sheet encerra silenciosamente | comportamento esperado do navegador |
| Fallback | Copiar link e abrir WhatsApp com mensagem codificada; Discord é explicado como colar o link copiado | brief |
| QR | Gerado inteiramente no navegador e representa exatamente a URL canônica; nenhum endpoint externo | brief |
| Download | Fora do primeiro recorte: copiar e compartilhar resolvem o fluxo sem conversão adicional para PNG | opcional no brief |
| Superfície | Diálogo reutilizando os componentes atuais do lobby, com fechamento por botão, clique externo e `Escape` | design system existente |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Compartilhar pelo dispositivo (Priority: P1)

Como anfitrião ou integrante da sala em um dispositivo compatível, quero abrir o compartilhamento nativo para enviar o convite pelo aplicativo que eu escolher.

**Why this priority**: é o caminho mais curto em celular e permite WhatsApp, Discord e demais destinos instalados sem integrações específicas.

**Independent Test**: abrir “Compartilhar sala” com `navigator.share` disponível e confirmar os três campos recebidos pela API.

**Acceptance Scenarios**:

1. **Given** uma sala privada e Web Share API disponível, **When** a pessoa aciona “Compartilhar sala” e confirma compartilhar, **Then** o navegador recebe título, texto curto e a URL exata de `roomLink()`.
2. **Given** o share sheet aberto, **When** a pessoa cancela, **Then** o diálogo permanece utilizável e nenhuma mensagem de erro é exibida.
3. **Given** uma falha real da API que não seja cancelamento, **Then** o diálogo apresenta retorno discreto e mantém cópia/QR disponíveis.

---

### User Story 2 — Ler o convite por QR Code (Priority: P1)

Como pessoa ao lado de quem criou a sala, quero escanear um QR Code legível para entrar sem digitar código ou transferir texto.

**Why this priority**: remove atrito entre telas e preserva o modelo privado por convite.

**Independent Test**: decodificar a matriz exibida e comparar o payload byte a byte com o link canônico da sala.

**Acceptance Scenarios**:

1. **Given** o diálogo de convite aberto, **Then** um QR Code com margem e contraste adequados representa exatamente a URL canônica da sala.
2. **Given** a geração do QR, **Then** nenhum identificador ou link é enviado pela rede a serviço externo.
3. **Given** desktop, tablet ou celular em paisagem, **Then** o QR permanece inteiro, legível e sem rolagem horizontal.

---

### User Story 3 — Compartilhar sem Web Share API (Priority: P2)

Como pessoa em navegador sem compartilhamento nativo, quero copiar o link ou abrir uma mensagem pronta no WhatsApp.

**Why this priority**: garante cobertura em desktop e navegadores incompatíveis.

**Independent Test**: remover `navigator.share`, copiar o convite e conferir a URL do WhatsApp decodificada.

**Acceptance Scenarios**:

1. **Given** Web Share API ausente, **When** o diálogo abre, **Then** oferece copiar link e abrir WhatsApp.
2. **Given** a ação WhatsApp, **Then** a mensagem e a URL são codificadas corretamente uma única vez.
3. **Given** a ausência de URL universal do Discord, **Then** a interface não inventa integração direta e explica que o link copiado pode ser colado no Discord.
4. **Given** o botão de cópia existente no lobby, **Then** ele continua copiando a mesma URL e informando sucesso.

---

### User Story 4 — Operar o diálogo com tecnologia assistiva (Priority: P1)

Como pessoa usando teclado ou leitor de tela, quero abrir, percorrer e fechar o convite sem perder o contexto.

**Why this priority**: o convite faz parte do caminho principal e segue o contrato AA do produto.

**Independent Test**: abrir apenas por teclado, verificar nome/descrição, ciclo de foco, `Escape` e retorno ao gatilho.

**Acceptance Scenarios**:

1. **Given** foco no gatilho, **When** o diálogo abre, **Then** o foco entra nele e fica contido enquanto estiver aberto.
2. **Given** o diálogo aberto, **When** `Escape` é pressionado, **Then** ele fecha e o foco retorna ao gatilho.
3. **Given** `prefers-reduced-motion: reduce`, **Then** nenhuma informação depende de animação e a transição é reduzida.

### Edge Cases

- A API de clipboard pode estar indisponível ou negar permissão; o erro não fecha o diálogo nem apaga o link visível.
- `navigator.share` pode existir e rejeitar por cancelamento ou por falha real; apenas a falha real é anunciada.
- Nome/código/link devem caber sem empurrar o QR para fora em 740×360.
- O diálogo pode ser reaberto várias vezes sem duplicar listeners nem perder a restauração de foco.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST manter `roomLink()` como única fonte da URL `/play?room=<id>`.
- **FR-002**: O lobby MUST manter código curto e ação existente de copiar link, além de expor a ação clara “Compartilhar sala”.
- **FR-003**: Quando `navigator.share` estiver disponível, o sistema MUST enviar título, texto curto e URL em campos próprios.
- **FR-004**: Cancelamento do compartilhamento MUST ser silencioso; falha não relacionada a cancelamento MUST ser anunciada de forma acessível.
- **FR-005**: Sem Web Share API, o diálogo MUST oferecer copiar link e abrir WhatsApp com mensagem e URL corretamente codificadas.
- **FR-006**: O fallback MUST explicar como usar o link no Discord e MUST NOT oferecer uma URL web fictícia de preenchimento do Discord.
- **FR-007**: O sistema MUST gerar o QR localmente no navegador, sem request de rede, contendo exatamente a URL canônica.
- **FR-008**: O QR MUST ter contraste, margem de silêncio e dimensão legível nas viewports suportadas.
- **FR-009**: O diálogo MUST reutilizar o design system atual e suportar teclado, foco contido, `Escape`, restauração de foco e leitor de tela.
- **FR-010**: A superfície MUST respeitar `prefers-reduced-motion` e funcionar em desktop, tablet e celular em paisagem.
- **FR-011**: A feature MUST NOT alterar criação, entrada, autenticação anônima, reentrada, autorização ou segurança da sala.
- **FR-012**: Testes automatizados MUST cobrir URL canônica, payload do QR, argumentos/cancelamento da Web Share API, fallback, codificação do WhatsApp, clipboard e foco.
- **FR-013**: Testes de navegador MUST cobrir o lobby em viewport desktop e compacta, com auditoria axe da superfície nova.

### Key Entities

- **Convite da sala**: título, texto curto e URL canônica já derivada de `roomLink()`.
- **QR do convite**: representação local e determinística da URL do convite, sem persistência ou transporte externo.
- **Capacidade de compartilhamento**: disponibilidade do Web Share API no navegador atual; define somente a ação oferecida, não o conteúdo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em navegador compatível, a pessoa chega ao share sheet em uma ação e a API recebe a URL exata.
- **SC-002**: Um decodificador de QR recupera exatamente o link da sala em 100% dos casos de teste.
- **SC-003**: Em navegador incompatível, copiar e WhatsApp permanecem disponíveis; a URL decodificada do WhatsApp contém mensagem e link completos.
- **SC-004**: O diálogo passa testes de teclado, foco, axe e `prefers-reduced-motion` nas viewports desktop e 740×360.
- **SC-005**: A instrumentação de teste comprova zero requests para serviços externos de QR Code.

## Assumptions

- O código da sala já é validado pela camada de sessão e pode ser interpolado somente por `roomLink()`.
- O compartilhamento nativo decide quais aplicativos aparecem; o produto não enumera nem garante destinos.
- Clipboard e abertura de WhatsApp são ações iniciadas pela pessoa e seguem as permissões do navegador.

## Fora do escopo

Download do QR como PNG, compartilhamento direto para Discord, mudança de URL, novo modelo de convite, analytics de compartilhamento e redesign do lobby.
