# D-072 — A Taxa de Fumaça sai da Cidade da Fuligem

**Data:** 2026-07-30 · **Status:** aceita · **Revoga parcialmente:** [D-070](D-070-fuligem-tem-topologia-e-regras-proprias.md) (somente a Taxa de Fumaça)

**Decisão:** a **Taxa de Fumaça** sai do jogo. Construir Fábrica, Complexo de Fábricas ou
Torre de Ferro na Cidade da Fuligem paga somente o custo normal da construção; nenhum valor
adicional é retirado do caixa nem enviado à Sorte Grande. Oficina, Ferrovia e Estação de
Carga permanecem como já eram.

A Fuligem conserva sua topologia própria, as Minas e o **Desvio pela Ferrovia**. A remoção
não altera aluguel, progressão de construção, bônus das Minas nem o funcionamento do pote
central.

**Por quê:** a taxa acrescentava uma exceção financeira em três níveis da escada sem criar
uma decisão nova. O jogador já decide construir considerando custo, uniformidade, limite de
posse e retorno de aluguel; somar uma sobretaxa temática exigia descobrir quando ela começa,
para onde vai e como compõe com a Mina de Estanho. A fantasia da fumaça não compensa esse
custo de aprendizado.

**Custo aceito:** menos dinheiro entra na Sorte Grande e mais caixa permanece em circulação,
o que pode alongar partidas. Nenhuma mecânica substituta entra neste passo. Se o ritmo
econômico piorar, o ajuste deve nascer de dados de partidas e de uma decisão própria, não de
uma cobrança temática reintroduzida por outro nome.

**Compatibilidade:** o emissor de `smoke-tax` deixa de existir, mas o leitor histórico do
evento permanece para salas persistidas que já o tenham no log. Ele não pode ser produzido
por nenhuma partida nova.

**Como aplicar:** SRS v1.32 remove a cobrança da §2.8. `MapRules` perde `smokeTax`; construção
volta a debitar somente seu custo; UI não mostra aviso nem acréscimo no botão; simulação e
testes deixam de contabilizar a taxa. A spec 056 registra a simplificação.
