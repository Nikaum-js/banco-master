# D-075 — Quarto nível de raridade: Épica

**Data:** 2026-07-30 · **Status:** aceita · **Contexto SRS:** §10.2 (raridade), §10.4–10.5
(composição) · **Refina:** [D-074](./D-074-raridade-de-carta-nao-inverte-probabilidade.md)

## Problema

A D-074 resolveu a mentira do sistema de raridade (rótulo que não correspondia a chance) e, ao
fazê-lo, produziu uma segunda: as **comuns deixaram de ser um grupo**. Depois que o excedente de
cada baralho foi todo empurrado para lá, "comum" passou a nomear duas populações que não têm nada
em comum além do nome —

- **comuns de 1 cópia** — Greve, Multa Ambiental, Volta ao GO, Honorários, Resgate do Pote…
  saem a **5,8%** no Tesouro;
- **comuns de 2 cópias** — Aniversário, Erro do Banco, Atalho, Avance 3…
  saem a **11,6%**, o **dobro**.

O jogador via isso na vitrine de probabilidades (spec 057): duas linhas verdes, mesmo selo de um
losango, mesma palavra "COMUM", e uma delas duas vezes mais provável que a outra. A hierarquia
estava correta na aritmética e ilegível na tela — que é o mesmo defeito da D-074 num degrau abaixo.

## Decisão

**Quatro níveis, com o nível novo entrando NO MEIO da escada** — não no topo, como "épica" costuma
entrar em jogos de carta. Cada degrau existente sobe um nome:

| Antes | Cópias | Depois | Cor |
|---|---|---|---|
| Lendária | 1 | 🟧 **Lendária** | Laranja |
| Rara | 1 | 🟪 **Épica** | **Roxo** (`--color-group-purple`) |
| Comum | 1 | 🟦 **Rara** | Azul |
| Comum | 2 | 🟩 **Comum** | Verde |

O que torna esta decisão barata é que a fronteira **já existia no dado**: `copies` separava os dois
grupos de comuns desde a D-074. A D-075 não move nenhuma carta entre grupos — dá nome ao grupo que
já estava lá. Nenhuma carta entra, sai ou muda de cópia; os baralhos seguem em 21 e 18.

Consequência estrutural que vale enunciar: **toda comum tem 2 cópias e todo nível acima dela tem
1**. A invariante da D-074 (nada duplicado passa por cima de um nível mais raro) deixa de depender
de vigilância caso a caso e passa a ser uma propriedade da própria definição dos níveis.

### Pesos

`RARITY_WEIGHT = { lendaria: 90, epica: 104, rara: 107, comum: 109 }` — escala ×10 sobre os
9 · 10 · 11 da D-074, porque não há inteiro entre 9 e 10 para o degrau novo.

O ajuste de magnitude foi pedido junto: **épica sobe, rara e comum cedem, lendária fica onde
estava.**

| Nível | Acaso (antes → depois) | Tesouro (antes → depois) |
|---|---|---|
| 🟧 Lendária | 4,1% → **4,1%** | 4,7% → **4,7%** |
| 🟪 Épica | 4,6% → **4,8%** | 5,3% → **5,5%** |
| 🟦 Rara | 5,0% → **4,9%** | 5,8% → **5,6%** |
| 🟩 Comum | 10,0% → **10,0%** | 11,6% → **11,5%** |

### O espaçamento mínimo é requisito, não estética

A primeira calibragem usou `90 · 106 · 107 · 108` — aritmeticamente ordenada, e **errada na tela**.
A vitrine arredonda para uma casa decimal, e 106 contra 107 sai como **5,6% contra 5,6%**: épica e
rara empatadas, exatamente o defeito que a D-074 existe para curar, mudado de degrau.

Daí a regra que fica: dois níveis vizinhos precisam distar o bastante para **sobreviver ao
arredondamento** — na ordem de 3 unidades de peso nos tamanhos de baralho atuais. Isso está travado
por teste (`deckOdds.test.ts`, "os quatro níveis saem com números DIFERENTES na tela"), que compara
o texto formatado e não a fração. Ordem invisível não é ordem.

## Consequências

- **Selo de raridade vai a 4 losangos** (lendária ◆◆◆◆ → comum ◆). O canal não-cromático fica mais
  necessário, não menos: roxo e azul são vizinhos de matiz, e a §12.6 proíbe cor como canal único.
- **A coluna de losangos da vitrine passa a ter largura fixa.** Com cada linha sendo um grid
  próprio, uma coluna elástica alinhava os nomes em x diferentes conforme a raridade — incômodo com
  três níveis, ruim com quatro.
- **`Rarity` ganha um membro**, e todo `Record<Rarity, …>` (cor, rótulo, losangos, ordem de
  desempate) exige a entrada nova — o compilador cobra, não a revisão.
- **Textos que diziam "rara" mudaram de referente.** O incidente do CARD 01
  (`tesouroRaraSaldo.test.ts`) narra "carta rara do Tesouro" falando do nível que hoje é Épica; o
  arquivo preserva o relato como foi escrito e traduz nas asserções.

## Alternativas descartadas

- **Épica no topo, acima de lendária.** É a convenção de outros jogos, mas exigiria rebaixar as
  quatro cartas mais decisivas do Acaso ou inventar um quinto nível acima delas. O problema real
  era a comum de dois pesos, e ele fica embaixo.
- **Separar as comuns só por cópias, sem nome novo** ("Comum ◆◆" e "Comum ◆"). Mantém a mesma
  palavra para chances que diferem em 2×, que é a queixa original.
- **Igualar as cópias para acabar com o grupo duplo.** Foi o caminho que a D-074 já demonstrou
  aritmeticamente impossível nos tamanhos de baralho do SRS.
