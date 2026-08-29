export const raios = {
  chip: 4, cartao: 8, bolha: 12, cauda: 6, folha: 16, pill: 9999,
} as const;

export type Raios = typeof raios;
