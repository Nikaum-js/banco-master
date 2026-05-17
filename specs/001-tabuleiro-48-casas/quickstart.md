# Quickstart — Verificar o Tabuleiro de 48 Casas

Como confirmar, depois de implementado, que o tabuleiro de 48 casas está correto. Alinhado aos Success Criteria da [spec](./spec.md#success-criteria-mandatory).

## 1. Rodar

```sh
bun run dev    # Vite dev server em http://localhost:5173
```

## 2. Checks estruturais (dados)

Validar contra `src/lib/boardData.ts`:

- [ ] `BOARD.length === 48`
- [ ] cantos em pos 0/12/24/36 (GO, Prisão, Férias, Vá-pra-Prisão) — **SC-001**
- [ ] contagem por kind: 28 property · 4 airport · 3 utility · 3 surpresa · 3 tesouro · 2 tax · 1 bus-ticket · 4 corner — **SC-005**
- [ ] por grupo: Itália/Egito/Japão/Reino Unido = 3; Índia/China/Brasil/EUA = 4 — **SC-003**
- [ ] 1 aeroporto por lado (pos 6/18/30/42)

> Sugestão: um teste/asserção simples percorrendo `BOARD` cobre todos os itens acima de uma vez.

## 3. Checks visuais (browser)

- [ ] O board renderiza como quadrado 13×13, 11 casas por lado entre os cantos — **SC-001**
- [ ] Cantos nas 4 quinas corretas; nada sobreposto/cortado
- [ ] Bandeiras-avatar continuam ancoradas na borda interna nos 4 lados (sem regressão da correção anterior)
- [ ] Casas compradas mostram a cor do dono (stripe/tint) e o header de aluguel; à venda mostram preço
- [ ] Espaço Bus Ticket e a 3ª utilidade renderizam com glifo + label próprios
- [ ] Tokens de jogador, construções e tarja de hipoteca posicionam corretamente nos novos ranges de lado

## 4. Check de jogabilidade (manual)

- [ ] 35 casas compráveis no total (28 cidades + 4 aeroportos + 3 utilidades) — **SC-002**
- [ ] Mover do pos 47 → 0 conta como passagem pelo GO
- [ ] Enviar à prisão leva ao pos 12

## Pronto quando

Todos os checks de seção 2 e 3 passam e nenhuma feature existente regrediu (movimento, compra, aluguel, cartas, render de tokens).
