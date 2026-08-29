export const familias = {
  sans: "Geist_400Regular",
  sansMedia: "Geist_500Medium",
  sansForte: "Geist_600SemiBold",
  mono: "JetBrainsMono_400Regular",
} as const;

export const tipografia = {
  displayMd: { fontFamily: familias.sansForte, fontSize: 24, lineHeight: 32, fontWeight: "600", letterSpacing: -0.48 },
  headlineSm: { fontFamily: familias.sansForte, fontSize: 18, lineHeight: 26, fontWeight: "600", letterSpacing: -0.27 },
  titleMd: { fontFamily: familias.sansForte, fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: -0.16 },
  titleSm: { fontFamily: familias.sansForte, fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: -0.07 },
  corpo: { fontFamily: familias.sans, fontSize: 14, lineHeight: 22, fontWeight: "400", letterSpacing: 0 },
  corpoMedio: { fontFamily: familias.sansMedia, fontSize: 14, lineHeight: 22, fontWeight: "500", letterSpacing: 0 },
  corpoRelaxado: { fontFamily: familias.sans, fontSize: 14, lineHeight: 22.75, fontWeight: "400", letterSpacing: 0 },
  rotuloSm: { fontFamily: familias.sansMedia, fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.12 },
  legenda: { fontFamily: familias.sans, fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0 },
  sobrancelha: { fontFamily: familias.sansMedia, fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.96 },
  codigo: { fontFamily: familias.mono, fontSize: 12, lineHeight: 18, fontWeight: "400", letterSpacing: 0 },
  chip: { fontFamily: familias.mono, fontSize: 11, lineHeight: 14, fontWeight: "400", letterSpacing: 0 },
} as const;

export type Tipografia = typeof tipografia;
