# Research: Log de eventos tipado

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

O que foi levantado antes de desenhar, o que mudou de direção por causa do levantamento, e o que foi descartado.

---

## 1. Levantamento: o estado real do log

Feito por leitura direta, não por memória. Os números da spec vêm daqui.

**Pontos de emissão: 14**, em 8 arquivos do motor.

| Arquivo | Linhas | Eventos |
|---|---|---|
| `turn/turnMachine.ts` | 57, 165, 331 | GO (passa/para), rolagem, rolagem em tentativa de saída da prisão |
| `turn/resolution.ts` | 61, 74 | espaço Bus Ticket, imposto |
| `economy/purchase.ts` | 44 | compra confirmada |
| `economy/resolveRentable.ts` | 36 | aluguel pago |
| `economy/trade.ts` | 181 | troca aceita |
| `cards/draw.ts` | 39, 51, 60 | saque de carta de mão, Atalho, efeito imediato |
| `falencia/falencia.ts` | 58, 112 | dívida paga, falência |
| `emprestimos/emprestimos.ts` | 153, 161 | juros pagos, juros não cobertos |

**Consumidores: 3.** A frase (`CenterLog`, `shared.tsx:1529`), o som (`classifyLogEntry`, `classify.ts:72`) e o ícone (`logEventIcon`, `shared.tsx:1515`). Os três derivam do texto.

**Nenhum reducer lê `state.log`.** Verificado: as 27 ocorrências de `logEvent`/`log` em `src/` são emissão ou leitura de apresentação. Isso é o que torna a fatia segura — reformar o tipo não pode mudar comportamento de regra, porque nenhuma regra consulta o log. FR-006 apenas **preserva** o que já é verdade, em vez de estabelecer algo novo.

---

## 2. O achado que não estava no backlog: 8 famílias silenciosas

O item 1 do backlog da auditoria descrevia o log tipado como destrave de *som robusto, cor do histórico, explicação de aluguel e i18n* — todos benefícios de **consumidor**. O levantamento achou um defeito maior, do lado da **emissão**.

`logEventIcon` (`shared.tsx:1515`) testa 6 regexes, cobrindo 8 famílias de evento:

```
/constru|hangar|hotel|arranha|vendeu/   /hipotec/   /leil/   /pote/   /fian/
```

Nenhuma dessas palavras aparece em qualquer `logEvent` do motor. Confirmado por contagem: `constru: 0`, `hipotec: 0`, `leil: 0`, `vendeu: 0`, `hangar: 0`, `arranha: 0`, `pote: 0`, `fian: 0`.

Os ramos são **inalcançáveis**, e o que isso revela não é ícone morto: é **evento que nunca foi emitido**. Construção, venda de construção, hipoteca, deshipoteca, leilão, pregão, coleta do Free Parking e fiança de prisão não aparecem no histórico. Quem constrói um hotel ou arremata um lote não vê nada.

Interpretação: alguém escreveu o seletor de ícone **prevendo** os eventos e a emissão nunca veio. É o modo de falha típico de acoplamento por texto — o consumidor não pode declarar dependência de algo que não existe, então a lacuna não gera erro em lugar nenhum. Um `switch` exaustivo sobre `kind` tornaria isso impossível: o ramo só existe se o `kind` existir.

Isso promoveu a cobertura de eventos a **US2 com prioridade P1**, ao lado da identidade — não era o objetivo original da fatia.

---

## 3. A direção que o levantamento inverteu: a moeda

**Hipótese inicial (errada):** `emprestimos.ts:153` emite `R$ ${interest}` enquanto os outros 13 pontos emitem `$${amount}`; logo o `R$` é o desvio e o `$` é o padrão do produto.

**O que a busca mostrou:** a UI inteira usa `R$` no formato pt-BR com separador de milhar, em **seis definições locais do mesmo formatador**:

| Local | Forma |
|---|---|
| `game/ui/landAuction/LandAuctionLayer.tsx:25` | `const money = (v) => \`R$ ${v.toLocaleString('pt-BR')}\`` |
| `game/ui/trade/TradeLayer.tsx:27` | idêntica |
| `game/ui/GameHUD.tsx:48` | `const fmt = (n) => \`R$ ${n.toLocaleString('pt-BR')}\`` |
| `game/ui/NoticeLayer.tsx:106` | inline |
| `game/ui/modals/ModalLayer.tsx:639` | inline |
| `boards/shared.tsx` | 5 pontos inline (832, 869, 1142, 1218, 2182) |

Ou seja: o log é o **único** lugar do produto que escreve `$1200` sem separador, e o `R$` dos juros estava acidentalmente **certo**.

**Consequência no desenho:** a fonte única é `R$ 1.200` (pt-BR), não `$120`. E o defeito é maior do que a spec original descreveu — não é "uma entrada com símbolo divergente", é o log falando outra moeda que o resto do jogo, mais seis cópias do formatador. FR-020 e SC-006 foram reescritos por isso, e a spec ganhou a correção no diagnóstico.

**Lição de método:** a divergência que se destaca (`R$` no meio de `$`) não é necessariamente a errada. Contar as duas convenções antes de escolher custou uma busca e evitou padronizar o produto inteiro no formato errado.

---

## 4. Alternativas descartadas

### 4.1 Acrescentar `kind` ao lado de `what`, sem tocar as frases

Já registrada e rejeitada na [D-032](../../docs/adr/D-032-log-de-eventos-tipado-narrativa-e-da-ui.md). Resumo do motivo: destrava som e ícone por muito menos trabalho, mas deixa os ids **dentro da string** — não fecha o defeito 2, que é o mais visível — e cria a obrigação permanente de manter frase e campos coerentes em 14 pontos, sem nada que verifique. Dois lugares onde a verdade pode divergir é pior que um lugar novo.

### 4.2 Campos num `payload` aninhado

`{ kind, who, payload: { … } }` em vez de campos no topo. Mais arrumado no papel, pior no consumidor: toda leitura viraria `e.payload.amount` com um `switch` em volta só para o TS aceitar. Com campos no topo, o narrowing por `kind` entrega o campo direto. Descartado.

### 4.3 Um `kind` por degrau do ladder de construção

`build-house` / `build-hotel` / `build-hotel2` / `build-skyscraper`. Descartado: o ladder já é modelado por nível em `cityLevel` (`construction.ts:25`), e abrir 4 `kind` duplicaria essa modelagem no log, obrigando som e ícone a tratar 4 casos que querem o mesmo som e o mesmo ícone. `build` com `level: number` mantém uma modelagem só; o substantivo da frase ("um hotel") é derivado do nível pelo descritor, onde escolha de palavra pertence.

### 4.4 `describeLogEntry` devolvendo string

Descartado (D3 do plan). A UI já colore dinheiro e precisa negritar nomes na cor do jogador; string obrigaria a re-parsear a frase com regex para achar o dinheiro — reintroduzindo o acoplamento por texto um andar acima. Devolve `LogSentence` (lista de fragmentos tipados).

### 4.5 `describeLogEntry` lendo a sala de um hook interno

Descartado: mataria a pureza e obrigaria a montar React para testar. Com `room` como parâmetro, SC-001 (zero id na frase) é provável em Node, inspecionando a estrutura devolvida.

### 4.6 Emitir `lot-won`/`lot-unsold` nos chamadores em vez de em `settleLot`

`settleLot` (`landAuction.ts:155`) é privada e chamada por `closeExpiredLandLots` e `closeLandAuction`. Emitir nos dois chamadores duplicaria a lógica de "houve vencedor válido?" e deixaria o force-close silencioso no dia em que alguém esquecesse um dos dois. Emitir dentro de `settleLot` cobre os dois caminhos por construção.

Nota: a spec 039 prometeu manter `settleLot` intacta. Aquela promessa era o critério de reuso **daquela** fatia e foi cumprida lá; ela não é um contrato permanente de imutabilidade.

### 4.7 Migrar snapshots antigos

Descartado em D-032 ("custo aceito"): produto pré-lançamento, única sala real é de teste. Escrever migração seria trabalho para um dado que ninguém tem. O tratamento é a variante `legacy` na exibição (FR-022), e nada mais.

### 4.8 Aproveitar a fatia para acrescentar os campos da explicação de aluguel

Descartado (D9 do plan). `rent` fica com `pos`/`amount`/`ownerId` e nada mais. Campo que ninguém lê é peso morto, e a lição da 039 está fresca: o contrato previa `openEstateAuction` devolver `{ state, claimed }` e o `claimed` se revelou desnecessário na implementação. Acrescentar campo a uma união tipada é barato — é justamente o que a fatia compra.

---

## 5. Riscos identificados

| Risco | Por que é real | Mitigação |
|---|---|---|
| **Regressão silenciosa de áudio** | A suíte de som afirma cues a partir de **frases**. Ao reescrevê-la para `kind`, "consertar" um caso mudando a expectativa é fácil, e a prova de não-regressão vira circular. | A tabela atual de `classifyLogEntry` (`classify.ts:72-83`) é transcrita **antes** de ser apagada, e serve de oráculo para a nova suíte (SC-009). |
| **Churn de asserção mascarando regra alterada** | 14 arquivos do motor tocados; muitas asserções de teste mencionam o formato do log. | SC-005 limita a reescrita ao que afirmava o formato antigo. Qualquer outra asserção que precise mudar é sinal de regra alterada — e nenhuma regra muda aqui. Ordem em 3 movimentos (D10 do plan) isola o barulho. |
| **`logKey` instável quebrando a detecção de som** | `countNewLogEntries` (035, FR-011) depende de chave de **valor** estável. `JSON.stringify` do objeto não serve: ordem de chaves depende da ordem de construção. | Chave por concatenação de campos em ordem fixa por `kind`. Teste: duas entradas idênticas em valor contam como duas; log irreconhecível não re-toca histórico. |
| **`assertNever` frouxo com `strict` desligado** | `strict` não está ligado em nenhum tsconfig do repo (registrado em 2026-07-26). A exaustividade por compilador é mais frágil do que aparenta, e `default: return null` compila e silencia. | Duas camadas (D6 do plan): compilador **e** teste iterando `ALL_LOG_KINDS`. A segunda sobrevive ao `strict` desligado. |
| **`'bank'` quebrando comparação existente** | `CenterLog` compara `l.who === 'Banco'` (`shared.tsx:1583`) para desenhar o selo do banco. | Mudança pontual e coberta pelo teste de apresentação. Snapshot velho cai em `legacy`, onde a comparação não se aplica. |
