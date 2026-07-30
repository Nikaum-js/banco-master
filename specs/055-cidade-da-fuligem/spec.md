# Feature Specification: Cidade da Fuligem — segundo mapa jogável

**Feature Branch**: `codex/cidade-da-fuligem`

**Created**: 2026-07-30

**Status**: Aprovada (autorização explícita do brief; ciclo completo liberado)

**Input**: User description: "Substituir completamente o antigo Fliperama Neon pelo segundo tabuleiro jogável Cidade da Fuligem (Revolução Industrial): mapa selecionável na home, gravado na sala, aplicado de ponta a ponta em todas as telas, com o mesmo motor, economia, posições, efeitos e regras do mapa atual."

> Regra criada antes da spec: [D-069](../../docs/adr/D-069-segundo-mapa-jogavel-cidade-da-fuligem.md), SRS v1.30 (§2.1, §11.1, §16). Esta spec operacionaliza a decisão; **nenhuma regra de jogo nasce aqui**.

> **Histórico:** os requisitos desta spec que exigiam 48 casas, paridade econômica e
> ausência de regra própria foram substituídos pela
> [D-070](../../docs/adr/D-070-fuligem-tem-topologia-e-regras-proprias.md), pela
> [D-071](../../docs/adr/D-071-minas-sao-ativos-passivos-sem-aluguel.md) e pela
> [spec 056](../056-fuligem-mecanicas-legibilidade/spec.md). Seleção autoritativa por sala,
> identidade visual e remoção do Neon continuam válidas.

## Clarifications

Resolvidas pelo brief, ADR e código real:

| Ambiguidade | Resolução | Fonte |
|---|---|---|
| Contagem por grupo × lista de propriedades | O brief lista Bairro da Fumaça com 2 e Centro da Cidade com 3, mas as posições atuais fixam o 1º grupo com **3** (pos 1/3/5) e o 9º com **2** (pos 41/44). A invariante dura do próprio brief ("mesmas posições, quantidades, valores") vence: Fumaça ganha **Travessa do Carvão** (3ª rua, vocabulário do brief) e Centro fica com **Avenida Central + Praça do Banco** (*Rua do Comércio* omitida). **Desvio sinalizado na entrega.** | brief (invariantes) + `boardData.ts` |
| Identificador interno dos grupos | `GroupKey` (`brown`…`platinum`) é contrato do motor (`THEME.HOUSE_COST`/`RENT_MULT`) e **não muda**; o catálogo de mapa fornece nome público e paleta por grupo | brief §Arquitetura |
| Ferrovia ↔ posição | Por lado do tabuleiro: pos 6 (lado inferior) = Ferrovia **Sul**, pos 18 (esquerdo) = **Oeste**, pos 30 (superior) = **Norte**, pos 42 (direito) = **Leste** | topologia (`sideOf`) |
| Utilidades ↔ posição | pos 14 = Mina de Carvão, pos 32 = Usina Elétrica, pos 43 = Companhia de Água (mesmos preços/regras; ícones próprios do mapa) | `boardData.ts` |
| Impostos ↔ posição | pos 4 ($200) = **Imposto da Cidade**; pos 45 ($100) = **Taxa de Fumaça** — valores intactos | `boardData.ts` |
| Textos de carta que citam "aeroporto"/"ônibus" | Apresentação por mapa: o efeito, id, raridade e timing não mudam; o texto exibido no mapa Fuligem diz Ferrovia/Bilhete de Trem (ex.: "Obras na Pista" → vá à Ferrovia mais próxima) | brief §Cartas |
| Landing page pública (051) | Toca-se somente o necessário para o seletor/imagem do segundo mapa; nada além | brief §Fora do escopo |
| Partida local de desenvolvimento | Boot local aceita o mapa explicitamente (parâmetro de boot, mesmo canal do `?players=N`) | brief §Decisão de produto |
| Sala sem `boardId` | Fallback `atlas` — salas antigas continuam válidas sem migração de dados | D-069 |
| Identificador `neon` | Extinto; nenhum alias, nenhuma compatibilidade | brief §Remoção |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mapa escolhido na home e gravado na sala (Priority: P1)

O host abre a home, vê os dois mapas (Cidades do Mundo e Cidade da Fuligem, ambos **jogáveis**), seleciona Cidade da Fuligem, cria a sala e o mapa fica gravado nela. Todos os convidados que entram pelo link recebem o mesmo mapa automaticamente; reload e reconexão o preservam; ninguém pode trocá-lo depois da criação.

**Why this priority**: sem o mapa autoritativo na sala, o resto é só CSS — é a diferença entre skin e segundo mapa jogável.

**Independent Test**: dois BrowserContexts (host + convidado): host cria sala com Fuligem, convidado entra pelo link e vê o mesmo conteúdo; reload de ambos preserva; sala antiga sem `boardId` abre como Atlas.

**Acceptance Scenarios**:

1. **Given** a home com o seletor de mapas, **When** o host seleciona Cidade da Fuligem e cria a sala, **Then** a sala nasce com `boardId = fuligem` e o lobby abre já temático.
2. **Given** uma sala `fuligem` criada, **When** um convidado entra pelo link, **Then** ele vê os mesmos nomes de casas, grupos e tema — sem depender de estado local do navegador dele.
3. **Given** uma partida `fuligem` em andamento, **When** qualquer participante recarrega ou reconecta, **Then** o mapa continua `fuligem`.
4. **Given** uma sala persistida sem campo de mapa (anterior a esta feature), **When** ela é aberta, **Then** o mapa é `atlas` e nada quebra.
5. **Given** uma sala criada, **When** qualquer cliente tenta alterar o mapa, **Then** não existe superfície nem comando para isso — o valor é imutável.

---

### User Story 2 - Partida completa na Cidade da Fuligem (Priority: P1)

Uma partida inteira roda no mapa novo: tabuleiro com os 10 bairros e 28 propriedades da Revolução Industrial nas mesmas posições e valores, Ferrovias, Mina de Carvão/Companhia de Água/Usina Elétrica, Sorte Grande, Bilhete de Trem, cartas, escrituras, leilões, trocas, empréstimos, dívida, HUD, log e classificação final — tudo falando a língua do mapa, com **exatamente** as mesmas regras, efeitos e economia do Atlas.

**Why this priority**: é o produto em si — o segundo mapa precisa ser jogável de ponta a ponta.

**Independent Test**: partida completa dirigida sobre o catálogo `fuligem` (mesmo roteiro do smoke atual) termina com classificação; asserção de paridade: posições, preços, aluguéis e efeitos idênticos aos do Atlas.

**Acceptance Scenarios**:

1. **Given** o catálogo `fuligem`, **When** comparado ao Atlas, **Then** as 48 casas têm os mesmos `pos`, `kind`, preços, aluguéis-base e grupos (`GroupKey`) — só nomes/ícones/textos mudam.
2. **Given** um jogador que para na Ferrovia Norte, **When** o aluguel é cobrado, **Then** a regra é a de aeroporto (§2.4), inclusive escalonamento e Estação de Carga dobrando (regra do Hangar, §13.6).
3. **Given** um jogador que para no espaço Bilhete de Trem, **When** o item é concedido, **Then** é o mesmo Bus Ticket (§10.7) — contador, janelas de uso e negociabilidade intactos.
4. **Given** um jogador que para na Sorte Grande, **When** coleta o prêmio, **Then** é o mesmo `centerPot` (§13.4) — semente, reabastecimento e fontes intactos.
5. **Given** uma carta sacada ("Obras na Pista"), **When** revelada no mapa Fuligem, **Then** o efeito é idêntico (id, raridade, timing) e apenas o texto apresentado usa o vocabulário do mapa.
6. **Given** construções (Oficinas → Fábrica → Complexo de Fábricas → Torre de Ferro), **When** compradas/vendidas, **Then** custos, escada e aluguéis são os de casas/hotel/2º hotel/skyscraper — sem exceção.

---

### User Story 3 - Lobby e transição temáticos (Priority: P2)

O lobby da sala Fuligem mostra um conjunto de fábricas à distância; cada assento ocupado acende uma parte da fábrica na cor daquele jogador; convite/QR, Ritual de Largada, histórico, presets e estados de conexão vestem o tema. Ao iniciar a partida, uma sirene curta toca e os portões se abrem na transição para o tabuleiro.

**Why this priority**: é a continuidade do mundo — mas depende da US1 e não bloqueia a jogabilidade.

**Acceptance Scenarios**:

1. **Given** um lobby `fuligem` com 2 assentos ocupados, **When** um 3º jogador senta, **Then** mais janelas/fornalhas acendem na cor dele; **When** ele sai, **Then** apagam.
2. **Given** o host iniciando a partida, **When** a transição roda, **Then** sirene breve + portões abrindo (estáticos sob `prefers-reduced-motion`, sem perda de informação).
3. **Given** um lobby `atlas`, **When** comparado ao de hoje, **Then** está intacto.

---

### User Story 4 - Neon completamente removido (Priority: P1)

Nenhuma referência funcional ao Fliperama Neon sobra no repositório: componentes, classes, tokens, fonte de pixel, scanlines, CRT, moedas, 1UP/high score, ticker, testes e comentários exclusivos.

**Why this priority**: o brief a exige como parte da definição de pronto; meio-removido é pior que não removido (código morto + identidade confusa).

**Acceptance Scenarios**:

1. **Given** o repositório final, **When** se busca por `HomeNeonArcade|NeonBackdrop|neon-|Press Start|1UP|high score|synthwave|data-board-theme="neon"`, **Then** nenhuma referência **funcional** resta (menções históricas em specs/ADRs antigos são registro, não código).
2. **Given** o tema Atlas, **When** inspecionado, **Then** nada dele foi removido ou alterado visualmente.

---

### User Story 5 - Identidade sonora da Fuligem (Priority: P3)

Sons discretos de máquinas, vapor, trem distante, carimbo, sino e fornalha acompanham os eventos (compra, aluguel, construção, hipoteca, leilão, prisão, início, falência, vitória), respeitando o unlock de autoplay e as preferências de áudio existentes.

**Acceptance Scenarios**:

1. **Given** uma partida `fuligem` com som habilitado, **When** eventos ocorrem, **Then** os cues do mapa tocam pelos mesmos canais/gatilhos do sistema atual (spec 035), sem som novo em evento que hoje não toca.
2. **Given** o mapa `atlas`, **When** a partida roda, **Then** os sons atuais permanecem os mesmos.

### Edge Cases

- Sala `fuligem` criada, host cai e reassume pelo snapshot → o mapa vem do snapshot/sala, nunca do estado local do navegador.
- Revanche (D-052) na mesma sala → o mapa persiste entre partidas (pertence à sala, não à partida).
- Histórico da sala (D-067) exibido no lobby de revanche → temático, sem alterar dados retidos.
- Preferência local de tema do navegador (se existir) nunca sobrepõe o mapa publicado de uma sala existente (mesmo padrão do preset, §11.7).
- Partida local (`?players=N`) sem seleção explícita → `atlas`; com parâmetro de mapa → `fuligem`.
- Deep-link de convite/QR (052) → o convidado entra e recebe o mapa da sala sem flash do tema errado (fallback só até a sala publicar).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O produto MUST oferecer um **catálogo de mapas** com fonte única por mapa: identificador estável (`atlas` | `fuligem`), nome público, grupos (nome + paleta por `GroupKey`), as 48 casas (nomes, ícones, textos), rótulos de apresentação dos contratos do motor (aeroporto→Ferrovia, hangar→Estação de Carga, bus-ticket→Bilhete de Trem, Free Parking/Loteria→Sorte Grande, casa→Oficina, hotel→Fábrica, 2º hotel→Complexo de Fábricas, skyscraper→Torre de Ferro), apresentação das cartas e cenários de home, lobby e partida.
- **FR-002**: O catálogo MUST NOT duplicar o motor: `THEME` (economia), posições, `SquareKind`, efeitos e ids de carta são únicos e compartilhados; o mapa `fuligem` MUST ter paridade byte a byte com o Atlas em `pos`, `kind`, `group`, `price`, `rent` e `amount`.
- **FR-003**: A sala MUST gravar o `boardId` na criação, publicá-lo pela autoridade a todos os participantes (entrada, reload, reconexão) e mantê-lo imutável; sala sem `boardId` MUST resolver para `atlas`.
- **FR-004**: A home MUST apresentar os dois mapas como jogáveis, com seleção antes da criação da sala, campo de nome, Criar sala, Entrar com convite e fatos do mapa (48 casas, 10 bairros, Bilhete de Trem); a home da Fuligem MUST substituir a antiga home Neon (cenário: cidade escura em planos, chaminés com fumaça lenta, fornalhas acesas, trilhos/trem ao fundo, postes elétricos antigos, névoa, painel de ferro/madeira/papel).
- **FR-005**: O mapa autoritativo da sala MUST selecionar catálogo **e** tema visual em todas as telas (identidade, lobby, erro, reentrada, partida, fim); o atributo `data-board-theme="fuligem"` MUST substituir o eixo `neon`.
- **FR-006**: O mapa Fuligem MUST usar os 10 bairros e propriedades do brief (com o reparo registrado em Clarifications), sem bandeiras ou códigos de país — apresentação por ícones simples (fábricas, chaminés, trens, engrenagens, lâmpadas, prédios).
- **FR-007**: O vocabulário MUST restringir-se à lista aprovada: GO, Banco, Propriedade, Bairro Completo, Aluguel, Hipoteca, Leilão, Troca, Empréstimo, Falência, Prisão, Vá para Prisão, Acaso e Tesouro permanecem; só os oito termos listados são renomeados.
- **FR-008**: O tabuleiro MUST continuar um jogo de tabuleiro legível: 2D superior, 48 casas separadas, cantos maiores, faixas de grupo, nome e preço legíveis, dados centrais, peças, construções como marcadores; nenhuma ilustração pode esconder nome, preço, dono, hipoteca ou construção.
- **FR-009**: Reações visuais dirigidas por estado do motor: compra acende placa/luz na cor do dono; hipoteca apaga a luz e adiciona placa "HIPOTECADA" (padrão além de cor); Bairro Completo conecta as propriedades; Estação de Carga visível na Ferrovia melhorada; Sorte Grande mostra o pote fisicamente; falência apaga as marcas do jogador — tudo sem regra nova.
- **FR-010**: Cartas, escrituras, mão, leilões, trocas, empréstimos, dívida, modais, HUD, log, classificação, desconexão/erro/reconexão e aviso de orientação MUST falar o tema (Acaso como telegrama/aviso de fábrica; Tesouro como desenho de invenção/documento valioso; escrituras como registros/plantas) mantendo efeitos, ids, raridades, privacidade e timing intactos.
- **FR-011**: Acessibilidade WCAG 2.2 AA no caminho de jogo (§12.6): contraste de texto preservado, fumaça nunca reduz leitura, estado nunca só por cor, grupos distinguíveis sob dicromacia, teclado íntegro, `prefers-reduced-motion` congela fumaça/trem/luzes/transições sem perder informação, sem flashes rápidos.
- **FR-012**: Desempenho: poucas camadas decorativas, animação por `transform`/`opacity`, sem animar filtros/fundos gigantes continuamente, sem centenas de elementos/timelines para fumaça e janelas, animações do mapa escondido pausadas; legível em desktop, tablet e celular paisagem (1440×900, 1024×768, 740×360).
- **FR-013**: Remoção completa do Neon (US4), sem aliases, provada por busca; o Atlas MUST permanecer intacto.
- **FR-014**: A identidade sonora da Fuligem MUST usar o sistema de som existente (canais, unlock de autoplay, preferências), sem sons de arcade.
- **FR-015**: A landing pública MUST ser tocada apenas no necessário para o seletor/imagem do segundo mapa.

### Key Entities

- **MapCatalog**: fonte única por mapa — `id` (`atlas` | `fuligem`), nome público, grupos (`GroupKey` → nome/paleta), 48 `Square`s de apresentação sobre o esqueleto econômico compartilhado, rótulos de apresentação, textos de carta, cenários.
- **Room.boardId**: identificador do mapa gravado na sala na criação; imutável; ausente ⇒ `atlas`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Host cria sala Fuligem e convidado real (BrowserContext isolado) entra pelo link recebendo o mesmo mapa; reload/reconexão preservam; sala sem `boardId` abre como Atlas. *(testes 1–6 do brief)*
- **SC-002**: Partida completa dirigida sobre o catálogo Fuligem termina com classificação; paridade econômica/estrutural com o Atlas provada por asserção; Ferrovia/Estação de Carga/Bilhete de Trem/Sorte Grande usam exatamente as regras de aeroporto/hangar/bus-ticket/`centerPot`; cartas com efeitos idênticos. *(testes 7–13)*
- **SC-003**: Acessibilidade da home, lobby e tabuleiro verificada (axe, teclado) e `prefers-reduced-motion` coberto. *(testes 14–15)*
- **SC-004**: Busca automatizada prova ausência de referências funcionais ao Neon. *(teste 16)*
- **SC-005**: Screenshots reais das 13 telas do brief nas 3 resoluções, inspecionadas; gates verdes: lint, typecheck, vitest, Playwright da feature, build, verificação de desempenho de troca de tema adaptada.

## Assumptions

- A persistência da sala já comporta campos de configuração (precedente `opening_mode`, D-046/045); `boardId` segue o mesmo caminho — coluna/campo na sala + publicação pela autoridade.
- Assets sonoros: reutiliza-se a infraestrutura da spec 035; os cues da Fuligem podem ser sintetizados/derivados como os atuais (sem dependência de asset externo novo).
- O tabuleiro Fuligem usa a MESMA topologia (`CLASSIC_TOPOLOGY`); nenhum board layer novo é necessário.
- Fora do escopo (brief): mecânicas novas, efeitos de carta novos, rebalanceamento, mudança de casas, tabuleiro não-quadrado, 3D, bots, chat, mudanças no Atlas, reforma da landing além do seletor.
