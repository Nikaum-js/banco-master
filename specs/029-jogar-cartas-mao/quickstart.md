# Quickstart — Painel "Minhas Cartas" (029)

## Testar a lógica (sem UI)

```bash
bunx vitest run tests/game/ui/handView.test.ts   # handCardsView + cardTargets
bunx vitest run tests/game                        # suíte inteira (cartas 006/015/016/017 intactas)
```

## Validar na tela (`bun run dev`)

Roteiro (single-player local):

1. **Sacar cartas de mão**: jogar até parar em Acaso/Tesouro e sacar cartas Lendárias/Raras (Aquisição Hostil, Boicote, Imunidade Temporária, Saia da Prisão…). Conferir o painel **"Minhas Cartas"**: cada carta com cor de raridade, nome e efeito; contador "X / 3".
2. **Timing**: numa carta de **próprio turno**, o "Usar" só habilita na vez do jogador; "Saia da Prisão" só habilita **preso**; **Diplomacia/Bunker** aparecem desabilitadas ("usada automaticamente").
3. **Sem alvo**: estando preso, usar "Saia da Prisão" → sai sem pagar, carta some, contador cai.
4. **Com alvo**: usar **Imunidade Temporária** → seletor lista **suas** propriedades; escolher uma → fica protegida 2 voltas (marca de efeito na casa). Usar **Boicote/Despejo/Aquisição** → seletor lista só alvos válidos de **outros**; escolher aplica (ou abre a reação de Diplomacia, se o alvo tiver).
5. **Privacidade**: os outros jogadores continuam mostrando só a **quantidade** de cartas, nunca o conteúdo.

## Pontos de atenção

- O painel mostra a mão do **jogador da vez** (o store joga sempre pelo ativo).
- Nenhuma regra muda: o que o seletor oferece é exatamente o que `playHandCard` aceita.
- Notificação "Aquisição Hostil sofrida" e modal "Free Parking coletado" ficam **fora** desta fatia (deferidos — ver spec §Out of Scope).
