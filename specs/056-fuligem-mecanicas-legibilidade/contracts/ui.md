# UI contracts — Spec 056

## Escritura de Mina

- mostra nome, metal, bônus, preço e hipoteca;
- afirma “não cobra aluguel”;
- afirma que não recebe construções;
- afirma que hipoteca desliga o bônus;
- não mostra escada ou linha de aluguel.

## Célula Fuligem

- título comprável usa o nome completo do catálogo no anel;
- quebra de linha é permitida;
- preço continua visível quando livre;
- dono, hipoteca e construção continuam legíveis.

## Leilão

- diálogo mantém `role="dialog"`, `aria-modal`, foco inicial e trap de Tab;
- camada cobre a viewport e bloqueia clique no tabuleiro;
- não há `backdrop-filter` nem preenchimento que reduza a leitura dos saldos laterais.
