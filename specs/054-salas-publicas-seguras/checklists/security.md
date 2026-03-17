# Security and Requirements Quality Checklist: Diretório opt-in

**Purpose**: validar completude, clareza, consistência, mensurabilidade e rastreabilidade dos requisitos antes da implementação
**Created**: 2026-07-30
**Feature**: [spec.md](../spec.md)

## Autoridade e identidade

- [x] CHK001 A identidade pública está explicitamente limitada à sessão anônima atestada, sem conta ou perfil? [Spec §Clarifications; FR-004–FR-005]
- [x] CHK002 A autorização de publicar/despublicar identifica o host atual como único ator permitido? [FR-002–FR-003]
- [x] CHK003 O requisito impede que decisão de autorização ou limite dependa apenas do cliente? [FR-026; FR-035]
- [x] CHK004 A fronteira entre autoridade server-side da admissão pública e autoridade host da partida está explícita? [D-068 §6–§7; Plan §Admissão]
- [x] CHK005 O comportamento do kick atual está preservado sem criar bloqueio persistente? [US1 cenário 5; FR-006]

## Privacidade e enumeração

- [x] CHK006 A sala privada por padrão e a compatibilidade de sala legada estão inequívocas? [FR-001; FR-044]
- [x] CHK007 A allowlist da listagem é fechada e lista também os campos proibidos? [FR-008–FR-010]
- [x] CHK008 O `listingId` está definido como não derivável do `roomId` e revogável? [FR-010]
- [x] CHK009 A spec proíbe leitura direta de `rooms` e fallback inseguro? [FR-037–FR-039]
- [x] CHK010 O cenário de recusa entre consulta e entrada veda `roomId` e estado privado? [US2 cenário 6; FR-028]
- [x] CHK011 Mãos, cartas, decks, snapshot, histórico e reentrada estão explicitamente fora de payloads públicos? [FR-009; Out of Scope]
- [x] CHK012 O critério de sucesso exige zero salas privadas e zero segredos nos ataques? [SC-001–SC-002; SC-013–SC-014]

## Elegibilidade e ciclo de vida

- [x] CHK013 Todos os predicados de `ListingEligibility` estão definidos simultaneamente? [FR-016]
- [x] CHK014 Lotação está distinguida de despublicação e permite reaparecimento? [FR-017–FR-018]
- [x] CHK015 Início despublica e revanche exige nova ação explícita? [FR-019–FR-021]
- [x] CHK016 A janela de presença tem início, tolerância e teto mensuráveis sem alterar a sala? [FR-022–FR-024; SC-004]
- [x] CHK017 Mensagens atrasadas e transições concorrentes têm resultado determinístico? [Edge Cases; FR-019]
- [x] CHK018 Diretório indisponível está isolado de sala, convite, reentrada e revanche? [FR-029–FR-030; FR-039; SC-009]

## Abuso e concorrência

- [x] CHK019 Os quatro limites aprovados têm unidade, janela e identidade definidas? [FR-031–FR-034]
- [x] CHK020 A exceção de republicar a mesma sala está separada de criar sala distinta? [FR-031]
- [x] CHK021 O máximo de um lobby publicado inclui listing temporariamente escondido? [FR-032; Edge Cases]
- [x] CHK022 Toda tentativa pública, inclusive recusada, está coberta pelo limite de entrada? [Contracts/public-admission]
- [x] CHK023 A corrida pela última vaga tem resultado observável e capacidade invariável? [US2 cenário 5; FR-027; SC-007]
- [x] CHK024 Os limites do diretório estão proibidos no convite privado? [FR-036]
- [x] CHK025 Os vetores de ataque reais enumeram escrita alheia, expiração, capacidade e limites? [FR-047; SC-013]

## UX, acessibilidade e recuperação

- [x] CHK026 Loading, vazio, erro, limite e indisponibilidade têm estados distintos? [FR-040; US5]
- [x] CHK027 O filtro aprovado está limitado a vagas e Ritual, com ordenação definida? [FR-012–FR-015]
- [x] CHK028 Teclado, foco, nomes acessíveis, contraste, toque, zoom e reduced motion estão exigidos? [FR-041]
- [x] CHK029 Mobile e ausência de rolagem horizontal têm critério verificável? [FR-042; SC-011]
- [x] CHK030 Mudança de elegibilidade não depende somente de cor/animação? [FR-043]
- [x] CHK031 A falha do diretório preserva ações privadas visíveis e operáveis? [US5 cenários 2–4]
- [x] CHK032 Axe cobre todos os estados e tem limiar sério/crítico explícito? [SC-010]

## Compatibilidade e observabilidade

- [x] CHK033 O fluxo privado lista criação, convite, kick, reload, reentrada e revanche como regressão obrigatória? [SC-008]
- [x] CHK034 BrowserContexts isolados identificam host, entrada pública e convidado privado? [FR-048; SC-012]
- [x] CHK035 A telemetria está limitada a agregados sem identificadores de sala, listing, nome ou uid? [FR-045]
- [x] CHK036 Credencial administrativa está proibida no navegador, resposta e bundle? [FR-046; SC-014]
- [x] CHK037 A spec declara dependências sobre 052/053 sem absorver convite, histórico, estatísticas ou presets? [Dependencies; Out of Scope]

## Escopo social negativo

- [x] CHK038 Contas, perfis, login, denúncia, bloqueio, moderação e sanção estão explicitamente excluídos? [Clarifications; Out of Scope]
- [x] CHK039 Chat, mensagens privadas, espectadores, ranking, Elo e matchmaking estão explicitamente excluídos? [Clarifications; Out of Scope]
- [x] CHK040 Título e descrição livre estão proibidos, eliminando conteúdo público moderável? [FR-009; Out of Scope]

## Notes

- Cobertura de rastreabilidade: 40/40 itens apontam para requisitos, cenários, critérios,
  contratos ou decisões específicas.
- Revisão concluída antes de `tasks.md`; nenhum item exige mudança de produto.
