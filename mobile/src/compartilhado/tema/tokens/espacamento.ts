export const espacamento = {
  xs: 4, sm: 8, md: 12, gutter: 16, lg: 20, xl: 24,
  alturaCabecalho: 56,
  alvoDeToque: 44,
  alturaMaximaComposer: 160,
  larguraMaximaColuna: 672,
} as const;

export type Espacamento = typeof espacamento;
