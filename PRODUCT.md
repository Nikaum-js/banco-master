# PRODUCT.md — Magnata Imobiliário

> Contexto durável de produto (Impeccable init). Fonte de regra: `docs/SRS.md`. Vocabulário: `CONTEXT.md`.

## O que é

Jogo de tabuleiro **multiplayer online** de negociação imobiliária, jogado no navegador, para **2 a 8 jogadores humanos** — sem bots, sem conta, sem instalação. Alguém cria uma sala, compartilha o link, e a mesa joga em tempo real: compra de cidades, construção, aluguel, leilões, cartas (Acaso/Tesouro), Bus Tickets, empréstimos e negociação livre entre jogadores. Não existe matchmaking público: o jogo acontece entre quem tem o link.

## Quem usa

Grupos de amigos (o "convocador" cria a sala e puxa a turma pelo WhatsApp/Discord). Cena de uso: noite, tela de laptop/celular, várias pessoas em chamada de voz.

## Mecanismo único

Negociação sem trilhos: propostas com propriedades, dinheiro, Bus Tickets e **imunidade de aluguel**; empréstimos entre jogadores com juros; pregões simultâneos. A mesa decide o valor das coisas — o jogo não legisla.

## Compromissos de marca

- Nome: **Magnata Imobiliário** (D-053). Nunca posicionar como Monopoly/Banco Imobiliário — projeto independente, não afiliado.
- Tema atual: **"Cidades do Mundo"** (48 casas, 10 países). É o primeiro universo, não a identidade inteira — a base foi construída para novos tabuleiros.
- Identidade visual vigente: **"Atlas da Meia-Noite"** (ver `DESIGN.md`).
- Tom: competitivo entre amigos, premium de jogo de mesa — nunca SaaS, cassino ou corporativo.
- Verdade absoluta: nenhuma afirmação pública sem lastro no SRS ou no código.

## Superfícies

- `/` landing pública (Persuade) · `/como-jogar` guia (Read) · `/faq` (Read) · `/play` o produto (Operate, React).

## Plataforma

Web (React + Vite + TS + Tailwind + Zustand + Supabase). Partida em paisagem no celular; WCAG 2.2 AA no caminho de jogo com gate de CI.
