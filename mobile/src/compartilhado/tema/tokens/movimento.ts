export const movimento = {
  duracaoRapida: 150,
  duracaoBase: 200,
  duracaoLenta: 300,
  curvaPadrao: [0.2, 0, 0, 1] as const,
} as const;

export type Movimento = typeof movimento;
