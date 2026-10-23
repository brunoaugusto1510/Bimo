export type TipoDeEventoWiki = "nasceu" | "cresceu" | "discordam" | "precisa_de_voce" | "sem_novidade" | "despertar" | "energia";
export type EventoWiki = { id: string; tipo: TipoDeEventoWiki; sinteseId: string | null; origemId: string | null; texto: string; criadoEm: string };
export type PeriodoDoDiario = { inicio: string; fim: string; limite?: number; antes?: { criadoEm: string; id: string } };
export type AlertaWiki = "sem_raizes" | "divergencias" | "duplicata" | "protegida_com_novidades" | "ligacao_quebrada";
export type DiagnosticoWiki = { assinatura: string; alertas: AlertaWiki[]; verificadoEm: string };
export type EstadoDoNeuronio = "vivo" | "reconsolidando" | "seu" | "em_tensao" | "sem_raizes" | "em_pausa";
export type EnergiaWiki = { teto: number; utilizada: number; restante: number; renovaEm: string };
export const renovarEnergiaEm = (agora = new Date()) => new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1)).toISOString();
