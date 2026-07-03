#!/bin/bash
# Stop hook (banco-master): roda a suíte de testes do motor quando há mudanças
# em src/ ou tests/ não commitadas. Falha bloqueia o encerramento do turno
# (exit 2 → stderr vira feedback para o Claude corrigir antes de parar).

input=$(cat)

# Evita loop infinito: se o turno já foi retomado por este hook, não roda de novo.
[[ $(echo "$input" | jq -r '.stop_hook_active // false') == "true" ]] && exit 0

cd "$(dirname "$0")/../.." || exit 0

# Só roda se houver mudanças relevantes (working tree ou staged)
[[ -z $(git status --porcelain -- src tests 2>/dev/null) ]] && exit 0

output=$(bunx vitest run tests/game 2>&1)
if [[ $? -ne 0 ]]; then
  echo "Testes falharam (bunx vitest run tests/game). Corrija antes de encerrar:" >&2
  echo "$output" | tail -40 >&2
  exit 2
fi
exit 0
