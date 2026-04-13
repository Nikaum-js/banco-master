// Roteiro fixo determinístico (036/US3, research.md D10): mesma REGRA por tipo de
// modal/estado em toda execução — não fuzzing (isso é papel exclusivo da camada
// headless, US1). Dirige todas as cadeiras no mesmo browser (single-client, Assumption).
//
// A decisão + o clique rodam num ÚNICO `page.evaluate` (DOM puro, sem locators do
// Playwright) — cada tick só faz 1 round-trip ao browser em vez de ~12 checagens
// sequenciais de `isVisible`/`isEnabled`, que multiplicado por centenas de ticks
// (10+ rodadas × várias animações por turno) inviabilizava o orçamento de tempo.
import type { Page } from '@playwright/test'

// Coleta erros de runtime (console.error / exceções não tratadas) durante o teste.
// Chamar ANTES de navegar; ler `errors` ao final (FR-010: falhar em qualquer erro).
export function trackRuntimeErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

// 1 passo da política, decidido e executado INTEIRAMENTE no browser. Prioridade
// espelha o bloqueio real do motor: dívida → reação → descarte/atalho de carta →
// compra (compra se couber no caixa, senão leilão) → prisão → finalizar → rolar.
// Retorna o texto do botão clicado, ou null se nada estava pronto (turno "livre" —
// dado rolando, peão andando etc.) e o caller deve só esperar um pouco.
async function clickOneStep(page: Page): Promise<{ clicked: string | null; rolled: boolean }> {
  return page.evaluate(async () => {
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
    const visibleEnabled = (b: HTMLButtonElement) => b.offsetParent !== null && !b.disabled
    const visible = (b: HTMLButtonElement) => b.offsetParent !== null
    const find = (pred: (t: string) => boolean, requireEnabled: boolean) =>
      buttons.find((b) => pred((b.textContent ?? '').trim()) && (requireEnabled ? visibleEnabled(b) : visible(b)))

    const hasFullHand = Array.from(document.querySelectorAll('h1,h2,h3,p')).some((el) => (el.textContent ?? '').includes('Mão cheia'))

    const candidates: Array<() => HTMLButtonElement | undefined> = [
      () => find((t) => t.startsWith('Pagar') && !t.startsWith('Pagar $50'), true), // dívida
      () => find((t) => t === 'Declarar falência', true),
      () => find((t) => t === 'Recusar', true), // reação (Diplomacia/Bunker) — sempre recusar
      () => (hasFullHand ? find(() => true, true) : undefined), // descarte forçado: qualquer carta
      () => find((t) => t === 'Guardar na mão', true), // revelação de carta
      // Atalho: sempre pra frente. O rótulo era `← Frente` até o picker virar cartão de
      // destino (03cb1ef) — a seta passou a ser SVG e saiu do textContent, deixando este
      // matcher órfão. Enquanto isso, toda execução que sacava a carta Atalho travava aqui
      // até o timeout, e como os dados do browser são Math.random() a falha era intermitente.
      () => find((t) => t.startsWith('Frente'), true),
      () => find((t) => t.startsWith('Comprar'), true),
      () => find((t) => t === 'Leilão', true), // sem caixa pra comprar
      () => find((t) => t.startsWith('Pagar $50'), true),
      () => find((t) => t === 'Tentar dupla', true),
      () => find((t) => t === 'Finalizar turno', true),
      () => find((t) => t === 'Rolar dados', true),
    ]

    for (const get of candidates) {
      const btn = get()
      if (btn) {
        const text = (btn.textContent ?? '').trim()
        btn.click()
        return { clicked: text, rolled: text === 'Rolar dados' }
      }
    }

    // Dívida presa: "Pagar" e "Declarar falência" existem mas os DOIS desabilitados —
    // caixa não cobre (canPay=false) mas o patrimônio cobre (canFalir=false), então o
    // motor espera o jogador hipotecar/vender no tabuleiro antes (GameHUD.tsx: "Hipoteque
    // ou venda no tabuleiro: ainda dá pra pagar."). Sem isso nenhum candidato acima bate
    // e o loop trava até o timeout — mais provável com 6 jogadores (mais turnos, caixa
    // por cabeça menor) do que com 2-3.
    const payBtn = find((t) => t.startsWith('Pagar') && !t.startsWith('Pagar $50'), false)
    const falirBtn = find((t) => t === 'Declarar falência', false)
    if (payBtn?.disabled && falirBtn?.disabled) {
      const popover = document.querySelector('[class*="w-[270px]"]')
      if (popover) {
        const act = (label: string) =>
          Array.from(popover.querySelectorAll('button')).find(
            (b) => (b.textContent ?? '').trim().startsWith(label) && !(b as HTMLButtonElement).disabled,
          ) as HTMLButtonElement | undefined
        // Hipoteca primeiro (reversível); vender construção/hangar como último recurso.
        const manageBtn = act('Hipotecar') ?? act('Vender Hangar') ?? act('Vender')
        if (manageBtn) {
          const text = (manageBtn.textContent ?? '').trim()
          manageBtn.click()
          await new Promise((r) => setTimeout(r, 200)) // acomoda a animação do popover
          return { clicked: text, rolled: false }
        }
        // Propriedade sem nada a fazer (não é do jogador ativo, ou já esgotada) — fecha
        // e a próxima chamada abre a casa seguinte via __e2eSquareIdx.
        const closeBtn = popover.querySelector('[aria-label="Fechar"]') as HTMLButtonElement | null
        closeBtn?.click()
        await new Promise((r) => setTimeout(r, 200))
        return { clicked: 'Fechar propriedade', rolled: false }
      }
      const cells = Array.from(document.querySelectorAll('.board-frame .cursor-pointer')) as HTMLElement[]
      const w = window as unknown as { __e2eSquareIdx?: number }
      const idx = (w.__e2eSquareIdx ?? 0) % (cells.length || 1)
      w.__e2eSquareIdx = idx + 1
      const cell = cells[idx]
      if (cell) {
        cell.click()
        await new Promise((r) => setTimeout(r, 200))
        return { clicked: 'Abrir propriedade', rolled: false }
      }
    }

    return { clicked: null, rolled: false }
  })
}

export async function step(page: Page): Promise<void> {
  const { clicked } = await clickOneStep(page)
  if (!clicked) await page.waitForTimeout(150) // animação em curso — só espera
}

// Roda passos até completar `minTurns` rolagens (proxy de rodada — cada `roll` é 1 turno
// de 1 cadeira; minRounds × playerCount cobre pelo menos minRounds rodadas completas).
export async function driveTurns(page: Page, minTurns: number): Promise<void> {
  let turns = 0
  let ticks = 0
  const maxTicks = minTurns * 60 // salvaguarda — cada turno raramente precisa de mais de ~15 passos
  while (turns < minTurns && ticks < maxTicks) {
    ticks++
    const { clicked, rolled } = await clickOneStep(page)
    if (rolled) turns++
    if (!clicked) await page.waitForTimeout(150)
  }
}

// Cenário semeado de fim de jogo (044/T049, D10 do plan). Só a NAVEGAÇÃO mora aqui — quem
// decide o estado (mesa de 2, um jogador perto da falência) é o motor, pelos mesmos reducers
// de produção; o mecanismo vive em `src/game/ui/e2eScenario.ts` (lido por `?scenario=endgame`
// no boot), mesmo tipo de andaime que `?players=N` já é desde a 036. Usado por
// `fullMatch.spec.ts` e `a11y.spec.ts` (tela de fim de jogo) — nenhum dos dois joga uma
// partida do zero; isso é o que o `sim:batch` prova, em lote, no motor.
export async function gotoEndgameScenario(page: Page): Promise<void> {
  await page.goto('/play?players=2&scenario=endgame')
}
