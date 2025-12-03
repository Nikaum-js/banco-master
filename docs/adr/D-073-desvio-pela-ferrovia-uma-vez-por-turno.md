# D-073 — Desvio pela Ferrovia pode ser usado uma vez por turno

**Data:** 2026-07-30 · **Status:** aceita · **Refina:** [D-070](D-070-fuligem-tem-topologia-e-regras-proprias.md)

**Decisão:** o jogador pode usar o **Desvio pela Ferrovia no máximo uma vez no mesmo
turno**. O direito volta no início do próximo turno. Permanecem as demais condições da
D-070: origem e destino precisam ser Ferrovias próprias e não hipotecadas; o deslocamento
é direto, não passa pelo GO e não cobra aluguel na chegada.

**Por quê:** sem um limite, a pós-condição recriava a própria pré-condição. Depois de
embarcar, o jogador terminava novamente sobre outra Ferrovia própria, com todas as
condições necessárias para embarcar de volta. Isso permitia alternar gratuitamente entre
estações indefinidamente e impedia o turno de chegar a uma decisão terminal.

**Custo aceito:** o jogador não pode encadear duas conexões no mesmo turno, mesmo possuindo
três ou quatro Ferrovias. O Desvio continua gratuito; limitar o uso resolve o ciclo sem
introduzir taxa, novo recurso ou cálculo adicional.

**Como aplicar:** SRS v1.33 explicita o limite. O estado do turno registra se o Desvio já
foi usado, consome o direito antes de resolver o destino e o restaura apenas quando um novo
turno começa. Snapshots anteriores, sem o campo, são tratados como “ainda não usado”.
