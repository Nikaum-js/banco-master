// Formatação de dinheiro — fonte única (040/D-032, D4 do plan). A convenção vencedora
// é a da UI: `R$` no formato pt-BR, com separador de milhar. O log é o único lugar do
// produto que escrevia `$1200` sem separador; as seis definições locais duplicadas
// (LandAuctionLayer, TradeLayer, GameHUD, NoticeLayer, ModalLayer, shared.tsx) convergem
// para esta função — não para uma segunda fonte.
export function money(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR')}`
}
