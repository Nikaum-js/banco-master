# Pesquisa: retenção leve na sala

## Fonte do resumo

**Decisão:** `matchSummary(game)` é a única fonte de classificação, patrimônio, propriedades, eliminação, rodadas e duração.

**Por quê:** já é pura, tolerante a snapshots legados e usada por todas as telas finais. Recalcular em outro módulo criaria dois resultados possíveis.

## Identidade estatística

**Decisão:** adicionar `historyId` público e restrito à sala.

**Alternativas rejeitadas:**

- `playerId`: muda quando leilão/dados reordenam os assentos.
- `uid`: identidade de transporte muda após reentrada por código.
- `reentryCode`: é credencial portadora e nunca pode ir ao histórico público.
- nome/cor: podem repetir ou mudar.

## Momento da gravação

**Decisão:** construir a entrada em `host.accept()` na transição `!wasEnded && ended`, antes do snapshot final.

**Por quê:** é o único ponto que já garante um evento por fato para telemetria. Montar na tela multiplicaria por clientes; montar na revanche perderia reloads antes do clique do host.

## Estrutura de armazenamento

**Decisão:** JSONB limitado na linha de `public.rooms`.

**Por quê:** o conjunto é pequeno, pertence à sala e precisa viajar junto com a versão autoritativa. Uma tabela/event stream adicionaria identidade, políticas e fan-out sem consulta que justifique.

## Estatísticas

**Decisão:** derivar sob demanda em TypeScript.

**Por quê:** no máximo 80 linhas de classificação; custo desprezível e nenhuma instrumentação do motor.

## Presets

**Decisão:** catálogo declarativo que contém `settings.openingMode`.

**Por quê:** o lobby já publica o modo. O preset só nomeia combinações existentes e não pode virar estado paralelo.

## Rollout

**Decisão:** sobrecarga 0007 → fallback 0006 → fallback 0005 somente na geração zero.

**Por quê:** deploy da aplicação e migration são operações separadas pela D-041. A sala não pode parar porque o cache de schema ainda não conhece a nova assinatura.
