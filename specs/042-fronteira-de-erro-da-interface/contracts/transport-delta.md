# Contrato — delta da porta `Transport`

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Porta atual**: `src/net/transport.ts`

> Mesma regra herdada da 037/041: nada aqui vale sem um caso em `tests/net/conformance.test.ts`, rodado contra os dois adapters (`localTransport`, `supabaseTransport`).

---

## `rejectCommand` — recusa por falha, unicast host→remetente

```ts
rejectCommand(toToken: string, info: { occurrenceId: string }): void
```

**Contrato**

1. Fire-and-forget, como `rejectJoin` — a porta não garante entrega, só envio (mesma classe de "garantias que a porta não dá" do cabeçalho de `transport.ts`).
2. Espelha exatamente `rejectJoin(fromToken, reason)` na forma — **e na semântica de transporte**: a mensagem trafega no MESMO canal que todos escutam (nada sensível nela, só o `occurrenceId`), e é o **assinante** (`client.ts`) quem filtra pelo próprio `toToken`. Não é um unicast de verdade na porta — é a mesma divergência que já existe em `rejectJoin`, e existir consistentemente é o ponto: nenhum adapter inventa um canal privado que o outro não tem.
3. `client.ts` assina `onCommandRejected`, descarta o que não é seu (`toToken !== this.token`) e expõe o último `occurrenceId` recebido (`lastCommandFailure()`) — sinal de sessão, distinto de `game`/`room` (mesma classe de `ConnectionState`, D-035).

**Por que existe**: `host.accept()` (`net/host.ts`) precisa de um caminho pra dizer "seu comando não foi aplicado, e não foi por regra — foi por falha" (FR-020/FR-022) sem reaproveitar `rejectJoin` (que é semanticamente sobre entrada na sala, não sobre um comando em jogo) e sem inventar difusão nova (o comando falho não é fato de jogo — nunca teve `seq`, nunca foi aceito).

**Conformidade cobra**: quem assina recebe o `toToken`/`occurrenceId` exatos enviados (o payload existe pra filtragem do lado do assinante); múltiplas recusas seguidas para o mesmo token chegam todas, em ordem (não é substituído silenciosamente).

**NÃO cobre**: recusa por regra (comando inválido) continua silenciosa — nenhuma mudança de comportamento aí. Este método só existe para o caminho de FALHA.
