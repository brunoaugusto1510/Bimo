export type Nota = {
  id: string;
  titulo: string;
  pasta: string;
  tags: string[];
  corpo: string;
  resumo: string;
  editadaEm: string;
  conexoes: number;
};

export type Aresta = { de: string; para: string };

export type Mensagem = {
  id: string;
  autor: "usuario" | "agente";
  texto: string;
  horario: string;
  cartoes?: string[];
};

export type Perfil = { nome: string; email: string; comoMeTratar: string };

export type TipoDeAcaoIA = "links" | "resumo" | "tags" | "continuar" | "perguntar";

export type Sugestao = {
  tipo: TipoDeAcaoIA;
  rotulo: string;
  texto: string;
  tags?: string[];
};

export type RespostaAgente = { texto: string; cartoes: string[] };

export type NoDoGrafo = { id: string; titulo: string; x: number; y: number; peso: number };
