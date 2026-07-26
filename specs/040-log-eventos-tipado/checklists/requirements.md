# Checklist de qualidade: Log de eventos tipado

**Spec**: [../spec.md](../spec.md) · gerada em 2026-07-26

Validação da spec **antes** da implementação. Marcado = verificado; ⚠️ = ponto que merece atenção durante a implementação.

---

## Cobertura de requisitos

- [x] Todo FR tem origem rastreável na spec ou em [D-032](../../../docs/adr/D-032-log-de-eventos-tipado-narrativa-e-da-ui.md) — nenhum requisito nasce no plan.
- [x] Todo FR é verificável por teste (nenhum "MUST ser elegante").
- [x] Todo SC é medível, e nenhum depende de inspeção visual — inclusive SC-001, que é verificável na estrutura de `LogSentence` sem renderizar React.
- [x] Cada US é independentemente testável e entregável: US1 conserta **como** o evento é exibido, US2 **quais** eventos existem, US3 **como** os consumidores decidem.
- [x] Os 3 defeitos do "Por que esta spec existe" estão ancorados em arquivo:linha e foram verificados por leitura, não por memória.

## Consistência com o corpo de conhecimento

- [x] **Nenhuma regra nova** — a spec declara explicitamente que o SRS não muda e não pede bump. §12.2 continua satisfeito e passa a ser **mais** cumprido.
- [x] Princípio I respeitado: a decisão de representação foi registrada em ADR **antes** da spec (D-032), não dentro dela.
- [x] Princípio VI: FR-015 preserva o saque genérico, e a spec explica que a garantia **melhora** (de disciplina humana para propriedade do tipo).
- [x] Princípio IV: FR-012 acrescenta log ao Free Parking, que é catch-up. Tratado no Constitution Check do plan — relata valor, sem rótulo.
- [x] Princípio VII: o log continua serializável; a quebra de snapshot está declarada como custo aceito, não escondida.
- [x] `CONTEXT.md` conferido: nenhum termo novo de **domínio** é introduzido (`kind`, `LogEntry`, descritor são vocabulário técnico, que pertence à spec, não ao glossário).
- [x] D-030 conferida: a reserva de privacidade-de-apresentação continua como está; esta fatia não a piora nem a resolve.

## Armadilhas identificadas

- [x] ⚠️ **Regressão silenciosa de áudio.** A suíte de som afirma cues a partir de frases; reescrevê-la para `kind` permite "consertar" um caso mudando a expectativa, tornando a prova circular. **Mitigado por T004**: o oráculo é transcrito e fica verde contra o código velho **antes** de qualquer mudança em `classify.ts`. Vigiar em T032.
- [x] ⚠️ **Churn de asserção mascarando regra alterada.** 14 arquivos do motor tocados. SC-005 limita a reescrita ao que afirmava o formato antigo; T014 instrui a **parar e investigar** se outra asserção precisar mudar.
- [x] ⚠️ **`assertNever` frouxo.** `strict` está desligado em todos os tsconfig do repo. A exaustividade por compilador é mais frágil do que parece — daí a segunda camada por teste (FR-026), e T036 provando que o gate morde.
- [x] ⚠️ **`logKey` instável.** `JSON.stringify` como chave quebraria `countNewLogEntries` de forma **intermitente**, que é o pior modo de falha para áudio. Ordem fixa de campos, verificada em T033.
- [x] ⚠️ **Teste de convergência com conclusão errada.** Comparar frase renderizada entre clientes falharia por motivo legítimo (salas diferentes) e conclusão errada. T034 compara `GameState.log`, não texto.
- [x] ⚠️ **Lint regredindo.** `logIcon`/`describeLog` em `shared.tsx` reintroduziriam o aviso de `react-refresh` que a sessão de 2026-07-25 zerou. Pastas novas justificadas no plan; verificado em T037.

## Escopo

- [x] Fora de escopo declarado e não vazando para os FR: explicação de aluguel, cor por tipo, i18n, agregação de eventos, timestamp, migração de snapshot.
- [x] A tentação de "já que estou aqui" está nomeada e recusada — D9 do plan recusa acrescentar campos de aluguel que ninguém lê ainda, citando o `claimed` da 039 como precedente.
- [x] O ganho de escopo **legítimo** está justificado: as 8 famílias silenciosas não estavam no item 1 do backlog e foram promovidas a US2/P1 porque o levantamento mostrou que são o defeito maior (§2 do research).

## Pontos que a spec deliberadamente NÃO resolve

- [x] A **frase** não converge entre clientes com salas diferentes. É o desenho (a convergência exigida é do estado), está registrado no Complexity Tracking, e não é apresentado como defeito.
- [x] `strict` continua desligado no repo. Ligar é decisão separada, com outro volume de erros — fora desta fatia, como a sessão de 2026-07-26 já registrou.
- [x] O log continua **sem timestamp**. Recência = ordem, invariante da 021 preservada.

## Prontidão

- [x] Nenhum `[NEEDS CLARIFICATION]` pendente.
- [x] Contrato escrito para as 4 superfícies (emissor, descritor, classificador de som, seletor de ícone), com assinaturas descartadas e o motivo.
- [x] `tasks.md` ordenado por dependência técnica, em 3 movimentos, cada um com checkpoint verde.
- [x] A promessa a vigiar está declarada: nenhum reducer ganha lógica de decisão sobre log (FR-006).

**Veredito**: pronta para implementação. A fatia é grande (~450 linhas de produção, ~60 casos), e o maior risco é de **churn**, não conceitual — endereçado pela ordem em 3 movimentos e por SC-005/SC-009.
