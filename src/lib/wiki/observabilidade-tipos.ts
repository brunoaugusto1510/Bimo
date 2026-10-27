export type TipoDeEventoWiki = "nasceu" | "cresceu" | "discordam" | "precisa_de_voce" | "sem_novidade" | "despertar" | "energia";
export type EventoWiki = { id: string; tipo: TipoDeEventoWiki; sinteseId: string | null; origemId: string | null; texto: string; criadoEm: string };
export type PeriodoDoDiario = { inicio: string; fim: string; limite?: number; antes?: { criadoEm: string; id: string } };
export type AlertaWiki = "sem_raizes" | "divergencias" | "duplicata" | "protegida_com_novidades" | "ligacao_quebrada" | "isolado";
/** Alertas que o Bimo trata sozinho (um neurônio isolado é relido para ganhar ligações): não pedem a pessoa nem vão ao Diário. */
export const pedeAtencao = (alerta: AlertaWiki | string): boolean => alerta !== "isolado";
/** `religacao`: quando a origem de um neurônio isolado foi relida para ligá-lo; tenta-se uma vez por isolamento. */
export type DiagnosticoWiki = { assinatura: string; alertas: AlertaWiki[]; verificadoEm: string; religacao?: string };
/** `verificadoEm` de um diagnóstico zerado na republicação que só guarda a marca de releitura: verifica-se de novo logo. */
export const DIAGNOSTICO_VAZIO_EM = "1970-01-01T00:00:00.000Z";
export type EstadoDoNeuronio = "vivo" | "reconsolidando" | "seu" | "em_tensao" | "sem_raizes" | "em_pausa";
export type EnergiaWiki = { teto: number; utilizada: number; restante: number; renovaEm: string };
export const renovarEnergiaEm = (agora = new Date()) => new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1)).toISOString();
