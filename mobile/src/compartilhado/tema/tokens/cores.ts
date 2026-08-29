export type Cores = {
  primaria: string;
  sobrePrimaria: string;
  primariaContainer: string;
  sobrePrimariaContainer: string;
  primariaInversa: string;
  primariaHover: string;
  primariaFixa: string;
  primariaFixaDim: string;
  sobrePrimariaFixa: string;
  sobrePrimariaFixaVariante: string;

  secundaria: string;
  sobreSecundaria: string;
  secundariaContainer: string;
  sobreSecundariaContainer: string;
  secundariaFixa: string;
  secundariaFixaDim: string;
  sobreSecundariaFixa: string;
  sobreSecundariaFixaVariante: string;

  terciaria: string;
  sobreTerciaria: string;
  terciariaContainer: string;
  sobreTerciariaContainer: string;
  terciariaFixa: string;
  terciariaFixaDim: string;
  sobreTerciariaFixa: string;
  sobreTerciariaFixaVariante: string;

  erro: string;
  sobreErro: string;
  erroContainer: string;
  sobreErroContainer: string;

  fundo: string;
  sobreFundo: string;
  superficie: string;
  superficieDim: string;
  superficieClara: string;
  superficieContainerMinima: string;
  superficieContainerBaixa: string;
  superficieContainer: string;
  superficieContainerAlta: string;
  superficieContainerMaxima: string;
  superficieVariante: string;
  sobreSuperficie: string;
  sobreSuperficieVariante: string;
  superficieInversa: string;
  sobreSuperficieInversa: string;
  contorno: string;
  contornoVariante: string;
  tintaSuperficie: string;

  textoCorpo: string;
  textoSuave: string;
  textoTenue: string;
  textoPlaceholder: string;
  textoLink: string;
  textoSobreAcento: string;
  superficiePagina: string;
  superficieCartao: string;
  superficieLinhaAtiva: string;
  superficieChip: string;
  superficieCodigo: string;
  textoCodigo: string;
  fioDeCabelo: string;
  fioDeCabeloForte: string;

  vidroBarra: string;
  vidroBolha: string;
  vidroDock: string;
  vidroFolha: string;
  vidroCartao: string;
  bolhaUsuario: string;
  bolhaUsuarioBorda: string;
  protecaoDock: readonly [string, string, string];
  tintaDoBlur: "light" | "dark";

  backdrop: string;

  anelFoco: string;
  anelFocoSuave: string;

  grafoNoBase: string;
  grafoNoSuave: string;
  grafoNoTenue: string;
  grafoNoSinal: string;
  grafoLigacao: string;
  grafoMistura: string;
  grafoNoPreenchimento: string;
  grafoNoBorda: string;
  grafoNoRotulo: string;
  grafoNoRotuloSelecionado: string;
  grafoLigacaoNomeada: string;
  grafoAnelSelecao: string;
};

export const coresClaro: Cores = {
  primaria: "#5e4bc0",
  sobrePrimaria: "#ffffff",
  primariaContainer: "#9988ff",
  sobrePrimariaContainer: "#2f1191",
  primariaInversa: "#c9bfff",
  primariaHover: "#9988ff",
  primariaFixa: "#e5deff",
  primariaFixaDim: "#c9bfff",
  sobrePrimariaFixa: "#1a0063",
  sobrePrimariaFixaVariante: "#4631a7",

  secundaria: "#4bb6c0",
  sobreSecundaria: "#ffffff",
  secundariaContainer: "#88f5ff",
  sobreSecundariaContainer: "#118691",
  secundariaFixa: "#defcff",
  secundariaFixaDim: "#bffaff",
  sobreSecundariaFixa: "#005b63",
  sobreSecundariaFixaVariante: "#319da7",

  terciaria: "#5e5d69",
  sobreTerciaria: "#ffffff",
  terciariaContainer: "#bab8c6",
  sobreTerciariaContainer: "#494955",
  terciariaFixa: "#e3e1ef",
  terciariaFixaDim: "#c7c5d3",
  sobreTerciariaFixa: "#1b1b25",
  sobreTerciariaFixaVariante: "#464651",

  erro: "#ba1a1a",
  sobreErro: "#ffffff",
  erroContainer: "#ffdad6",
  sobreErroContainer: "#93000a",

  fundo: "#fcf8fb",
  sobreFundo: "#1b1b1d",
  superficie: "#fcf8fb",
  superficieDim: "#dcd9dc",
  superficieClara: "#fcf8fb",
  superficieContainerMinima: "#ffffff",
  superficieContainerBaixa: "#f6f3f5",
  superficieContainer: "#f0edef",
  superficieContainerAlta: "#eae7ea",
  superficieContainerMaxima: "#e4e2e4",
  superficieVariante: "#e4e2e4",
  sobreSuperficie: "#1b1b1d",
  sobreSuperficieVariante: "#3e4a40",
  superficieInversa: "#303032",
  sobreSuperficieInversa: "#f3f0f2",
  contorno: "#6e7a6f",
  contornoVariante: "#bdcabd",
  tintaSuperficie: "#5e4bc0",

  textoCorpo: "#1b1b1d",
  textoSuave: "#3e4a40",
  textoTenue: "#6e7a6f",
  textoPlaceholder: "#bdcabd",
  textoLink: "#5e4bc0",
  textoSobreAcento: "#ffffff",
  superficiePagina: "#fcf8fb",
  superficieCartao: "#f6f3f5",
  superficieLinhaAtiva: "#f6f3f5",
  superficieChip: "#eae7ea",
  superficieCodigo: "#303032",
  textoCodigo: "#1b1b25",
  fioDeCabelo: "#bdcabd",
  fioDeCabeloForte: "#6e7a6f",

  vidroBarra: "rgba(252,248,251,0.90)",
  vidroBolha: "rgba(252,248,251,0.60)",
  vidroDock: "rgba(252,248,251,0.60)",
  vidroFolha: "rgba(252,248,251,0.85)",
  vidroCartao: "rgba(246,243,245,0.80)",
  bolhaUsuario: "rgba(94,75,192,0.90)",
  bolhaUsuarioBorda: "rgba(94,75,192,0.20)",
  protecaoDock: ["#fcf8fb", "rgba(252,248,251,0.60)", "rgba(252,248,251,0)"],
  tintaDoBlur: "light",

  backdrop: "rgba(27,27,29,0.18)",

  anelFoco: "#5e4bc0",
  anelFocoSuave: "rgba(94,75,192,0.20)",

  grafoNoBase: "#889299",
  grafoNoSuave: "#a0aab2",
  grafoNoTenue: "#dcd9dc",
  grafoNoSinal: "#5e4bc0",
  grafoLigacao: "rgba(136,146,153,0.15)",
  grafoMistura: "multiply",
  grafoNoPreenchimento: "#fcf8fb",
  grafoNoBorda: "#6e7a6f",
  grafoNoRotulo: "#3e4a40",
  grafoNoRotuloSelecionado: "#1b1b1d",
  grafoLigacaoNomeada: "rgba(94,75,192,0.22)",
  grafoAnelSelecao: "rgba(94,75,192,0.35)",
};

export const coresEscuro: Cores = {
  primaria: "#c9bfff",
  sobrePrimaria: "#2f1191",
  primariaContainer: "#4631a7",
  sobrePrimariaContainer: "#e5deff",
  primariaInversa: "#5e4bc0",
  primariaHover: "#e5deff",
  primariaFixa: "#e5deff",
  primariaFixaDim: "#c9bfff",
  sobrePrimariaFixa: "#1a0063",
  sobrePrimariaFixaVariante: "#4631a7",

  secundaria: "#bffaff",
  sobreSecundaria: "#118691",
  secundariaContainer: "#319da7",
  sobreSecundariaContainer: "#defcff",
  secundariaFixa: "#defcff",
  secundariaFixaDim: "#bffaff",
  sobreSecundariaFixa: "#005b63",
  sobreSecundariaFixaVariante: "#319da7",

  terciaria: "#c7c5d3",
  sobreTerciaria: "#30303a",
  terciariaContainer: "#464651",
  sobreTerciariaContainer: "#e3e1ef",
  terciariaFixa: "#e3e1ef",
  terciariaFixaDim: "#c7c5d3",
  sobreTerciariaFixa: "#1b1b25",
  sobreTerciariaFixaVariante: "#464651",

  erro: "#ffb4ab",
  sobreErro: "#690005",
  erroContainer: "#93000a",
  sobreErroContainer: "#ffdad6",

  fundo: "#131315",
  sobreFundo: "#e4e2e4",
  superficie: "#131315",
  superficieDim: "#131315",
  superficieClara: "#393739",
  superficieContainerMinima: "#0e0d0f",
  superficieContainerBaixa: "#1b1b1d",
  superficieContainer: "#1f1f21",
  superficieContainerAlta: "#2a292b",
  superficieContainerMaxima: "#353436",
  superficieVariante: "#3e4a40",
  sobreSuperficie: "#e4e2e4",
  sobreSuperficieVariante: "#bdcabd",
  superficieInversa: "#e4e2e4",
  sobreSuperficieInversa: "#303032",
  contorno: "#889589",
  contornoVariante: "#3e4a40",
  tintaSuperficie: "#c9bfff",

  textoCorpo: "#e4e2e4",
  textoSuave: "#bdcabd",
  textoTenue: "#889589",
  textoPlaceholder: "#3e4a40",
  textoLink: "#c9bfff",
  textoSobreAcento: "#2f1191",
  superficiePagina: "#131315",
  superficieCartao: "#1b1b1d",
  superficieLinhaAtiva: "#1b1b1d",
  superficieChip: "#2a292b",
  superficieCodigo: "#e4e2e4",
  textoCodigo: "#1b1b25",
  fioDeCabelo: "#3e4a40",
  fioDeCabeloForte: "#889589",

  vidroBarra: "rgba(19,19,21,0.90)",
  vidroBolha: "rgba(19,19,21,0.60)",
  vidroDock: "rgba(19,19,21,0.60)",
  vidroFolha: "rgba(19,19,21,0.85)",
  vidroCartao: "rgba(27,27,29,0.80)",
  bolhaUsuario: "rgba(201,191,255,0.90)",
  bolhaUsuarioBorda: "rgba(201,191,255,0.20)",
  protecaoDock: ["#131315", "rgba(19,19,21,0.60)", "rgba(19,19,21,0)"],
  tintaDoBlur: "dark",

  backdrop: "rgba(27,27,29,0.18)",

  anelFoco: "#c9bfff",
  anelFocoSuave: "rgba(201,191,255,0.20)",

  grafoNoBase: "#9aa4ab",
  grafoNoSuave: "#7e888f",
  grafoNoTenue: "#3a3d40",
  grafoNoSinal: "#c9bfff",
  grafoLigacao: "rgba(154,164,171,0.18)",
  grafoMistura: "screen",
  grafoNoPreenchimento: "#1f1f21",
  grafoNoBorda: "#889589",
  grafoNoRotulo: "#bdcabd",
  grafoNoRotuloSelecionado: "#e4e2e4",
  grafoLigacaoNomeada: "rgba(201,191,255,0.28)",
  grafoAnelSelecao: "rgba(201,191,255,0.35)",
};
