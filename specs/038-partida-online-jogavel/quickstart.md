# Quickstart — spec 038

Como rodar, verificar e demonstrar a fatia. A infra da 037 está viva (migration aplicada em `edppdqrkqljhjkbyjvsz`), então tudo abaixo funciona de ponta a ponta.

## Rodar

```bash
bun run dev                      # single-player (sem parâmetro de sala) — deve seguir idêntico
bun run dev                      # e abrir /?host=1 para criar sala; o link vira /?room=<id>
```

Dois jogadores de verdade: abra a sala num browser e o link copiado em **outro browser** (ou janela anônima) — abas do mesmo browser compartilham `localStorage`, logo compartilham o token de sessão, e a segunda aba faria *takeover* do mesmo assento (FR-006a da 037) em vez de virar um segundo jogador.

## Verificar (gates)

```bash
bunx vitest run tests/net        # camada de rede + perspectiva local (rápido)
bunx vitest run                  # suíte completa — 397+ testes, motor intacto (SC-007)
bunx tsc --noEmit -p tsconfig.app.json
bunx eslint src/net src/game/ui src/App.tsx
bun run scripts/net-smoke.ts     # infra real: propagação, convergência, anti-spoof
```

## Roteiro de aceitação manual (o que a suíte headless não cobre)

Com dois browsers na mesma sala:

1. **US1 — perspectiva**: na vez do adversário, sua tela mostra "aguardando \<nome\>" e nenhum controle de decisão dele. Na sua vez, o inverso.
2. **US1 — mão privada**: abra "Minhas Cartas" durante a vez do adversário — a mão exibida continua sendo a sua. No HUD dele, só a contagem.
3. **US1 — ator fora do turno**: abra um leilão. Ambos conseguem dar lance da própria tela, mesmo quem não é o dono do turno. Uma proposta de troca aparece para responder **só** no destinatário.
4. **US2 — identidade**: nenhum `p1`/`p2` em lugar nenhum — painel, log, modais, vitória.
5. **US3 — pausa**: feche o browser do convidado. O outro exibe a pausa nomeando quem caiu, com prazos congelados; reabra o link e a partida retoma sozinha.
6. **US3 — D-029**: leve um jogador à falência e feche o browser dele. A partida **não** pausa para os sobreviventes.
7. **US4 — roteamento**: partindo de `/`, criar sala, entrar pelo link no outro browser, remover o convidado no lobby (ele é avisado, a cor volta a ficar livre), reconvidar e iniciar.
8. **US5 — ordem**: inicie duas partidas com os mesmos assentos; a ordem sorteada varia e é a mesma nos dois clientes.

## Limpar salas de teste

O cliente anônimo **não** apaga salas (não existe policy de DELETE — proposital). Use o MCP do Supabase ou o SQL Editor:

```sql
delete from public.rooms where updated_at < now() - interval '1 day';
```
