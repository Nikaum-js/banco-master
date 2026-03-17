// Porta de telemetria (044, US6 / D-040). Mesmo desenho da porta `Transport` (D-020): uma
// interface, adaptadores atrás dela, adaptador NULO por padrão — motor e sessão de rede não
// importam nada além deste arquivo, então trocar (ou desligar) o destino não muda quem emite.
//
// Contrato completo: specs/044-polimento-lancamento/contracts/telemetry-port.md.
//
// A união de eventos é FECHADA de propósito: não existe `payload`, `meta`, `extra` nem
// `props`. Um campo livre é exatamente onde, daqui a seis meses, alguém coloca o nome do
// jogador "só para depurar" — o que a D-040 proíbe em prosa, este tipo impede em compilação.
export type TelemetryEvent =
  | { kind: 'room_created'; matchKey: string }
  | { kind: 'match_started'; matchKey: string; players: number }
  | { kind: 'match_ended'; matchKey: string; players: number; rounds: number; durationMs: number | null }
  | { kind: 'match_paused'; matchKey: string; cause: 'disconnect' | 'persistence' }
  | { kind: 'public_directory_opened' }
  | { kind: 'public_room_published' }
  | { kind: 'public_room_joined' }

export interface Telemetry {
  /** Dispara e esquece (T1/T2 do contrato). NUNCA lança, NUNCA devolve algo que o chamador
   *  precise aguardar — falha de rede, destino fora do ar ou resposta de erro são engolidas
   *  pelo adaptador, sem retentativa. */
  track(event: TelemetryEvent): void
}

export const nullTelemetry: Telemetry = { track: () => {} }
