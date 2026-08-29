import { create } from "zustand";
import type { Nota, Sugestao, TipoDeAcaoIA } from "@/dados/tipos";
import type { ServicoIA } from "@/servicos";

const CARACTERES_POR_NO = 18;

type EstadoEditor = {
  titulo: string;
  texto: string;
  tags: string[];
  menuIA: boolean;
  sugestao: Sugestao | null;
  carregadosNoUltimoNo: number;
  // Bookkeeping interno — não faz parte da interface pública do brief.
  // `idCarregado` é uma checagem extra e barata (defesa em profundidade);
  // `tokenDeCarregamento` é o mecanismo de verdade contra corrida.
  // `tituloTocado`/`textoTocado`/`tagsTocadas` rastreiam, campo a campo, se
  // o usuário já mexeu ali desde que a nota foi aberta. Ver os comentários
  // em `abrirNota`/`aplicarConteudo` abaixo.
  idCarregado: string | null;
  tokenDeCarregamento: number;
  tituloTocado: boolean;
  textoTocado: boolean;
  tagsTocadas: boolean;

  // Chamado de forma síncrona, assim que o Editor decide abrir uma nota
  // (mount ou troca de `id`) — antes de qualquer fetch. Zera tudo para essa
  // nota e devolve um token que identifica esta abertura de forma única.
  abrirNota: (id: string) => number;
  // Chamado quando o fetch do vault resolve, com o token devolvido por
  // `abrirNota`. Só aplica, campo a campo, o que o usuário ainda não tiver
  // tocado desde a abertura — e só se ainda for a abertura mais recente.
  aplicarConteudo: (nota: Nota, token: number) => void;
  definirTitulo: (titulo: string) => void;
  digitarTexto: (texto: string, aoCrescer: () => void) => void;
  abrirMenu: () => void;
  fecharMenu: () => void;
  rodarAcao: (ia: ServicoIA, tipo: TipoDeAcaoIA, nota: Nota, aoPulsar: () => void) => Promise<void>;
  inserirSugestao: (aoCrescer: () => void) => void;
  descartarSugestao: () => void;
  // Hygiene de teste: devolve o estado ao ponto de partida (inclusive
  // `idCarregado`/`tokenDeCarregamento`/os `*Tocado(s)`), para que um `it`
  // não vaze estado interno para o próximo.
  resetar: () => void;
};

const ESTADO_INICIAL = {
  titulo: "",
  texto: "",
  tags: [] as string[],
  menuIA: false,
  sugestao: null as Sugestao | null,
  carregadosNoUltimoNo: 0,
  idCarregado: null as string | null,
  tokenDeCarregamento: 0,
  tituloTocado: false,
  textoTocado: false,
  tagsTocadas: false,
};

export const useEstadoEditor = create<EstadoEditor>((set, get) => ({
  ...ESTADO_INICIAL,

  // CORRIDA DE PRODUÇÃO — encontrada uma vez, conserto estreito demais na
  // primeira tentativa (só protegia `sugestao`/`menuIA`), agora corrigido
  // por completo com `abrirNota` + `aplicarConteudo`:
  //
  // (1) `sugestao`/`menuIA` nunca são tocados por `aplicarConteudo` — só por
  //     `abrirNota` (na abertura, síncrona) e pelas próprias ações do
  //     usuário (`rodarAcao`, `inserirSugestao`, `descartarSugestao`,
  //     `abrirMenu`/`fecharMenu`). Isso por si só já torna impossível o load
  //     assíncrono apagar uma sugestão que acabou de chegar — não depende de
  //     comparar id, token ou flag nenhuma para esses dois campos.
  //
  // (2) `titulo`/`texto`/`tags` — que os TextInput deixam interativos desde
  //     o primeiro paint, igual ao botão Bimo que motivou o conserto — são
  //     protegidos campo a campo: `tituloTocado`/`textoTocado`/`tagsTocadas`
  //     viram `true` assim que o usuário mexe em cada um, e
  //     `aplicarConteudo` pula exatamente os campos tocados, aplicando
  //     normalmente os que não foram. Perder a digitação do usuário em UM
  //     campo não deveria custar os outros dois ficarem em branco para
  //     sempre — por isso por campo, não um "tudo ou nada" no registro
  //     inteiro.
  //
  // (3) Uma resposta obsoleta — o fetch de uma nota A que só termina depois
  //     de o usuário já ter fechado A e aberto uma nota B — não pode
  //     sobrescrever o que já é de B. `tokenDeCarregamento` é incrementado
  //     em CADA `abrirNota()`, esteja essa chamada na mesma instância do
  //     Editor (o `id` mudou sem desmontar) ou numa instância diferente (A
  //     foi desmontado, B é um componente novo com fechos/refs próprios —
  //     por isso o token mora na store global e não numa ref local do
  //     componente: uma ref local não sobreviveria à desmontagem de A e não
  //     protegeria B). `aplicarConteudo` só aplica se o token recebido ainda
  //     for o mais recente da store NO MOMENTO em que a promise resolve.
  //     Comparar apenas o id contra `idCarregado` não bastava: duas buscas
  //     em voo para o MESMO id (reabrir a mesma nota rápido, por exemplo)
  //     teriam o id sempre batendo, e a mais antiga podia sobrescrever a
  //     mais nova. `idCarregado` continua como checagem extra barata, mas
  //     quem decide é o token.
  abrirNota: (id) => {
    const token = get().tokenDeCarregamento + 1;
    set({
      titulo: "",
      texto: "",
      tags: [],
      menuIA: false,
      sugestao: null,
      carregadosNoUltimoNo: 0,
      idCarregado: id,
      tokenDeCarregamento: token,
      tituloTocado: false,
      textoTocado: false,
      tagsTocadas: false,
    });
    return token;
  },

  aplicarConteudo: (nota, token) => {
    const estado = get();
    if (token !== estado.tokenDeCarregamento) return;
    if (nota.id !== estado.idCarregado) return;
    set({
      ...(estado.tituloTocado ? {} : { titulo: nota.titulo }),
      ...(estado.textoTocado ? {} : { texto: nota.corpo, carregadosNoUltimoNo: nota.corpo.length }),
      ...(estado.tagsTocadas ? {} : { tags: nota.tags }),
    });
  },

  definirTitulo: (titulo) => set({ titulo, tituloTocado: true }),

  digitarTexto: (texto, aoCrescer) => {
    const { carregadosNoUltimoNo } = get();
    const cresceu = texto.length - carregadosNoUltimoNo >= CARACTERES_POR_NO;
    set({
      texto,
      carregadosNoUltimoNo: cresceu ? texto.length : carregadosNoUltimoNo,
      textoTocado: true,
    });
    if (cresceu) aoCrescer();
  },

  abrirMenu: () => set({ menuIA: true }),
  fecharMenu: () => set({ menuIA: false }),

  rodarAcao: async (ia, tipo, nota, aoPulsar) => {
    set({ menuIA: false });
    aoPulsar();
    const sugestao = await ia.acaoNaNota(tipo, nota);
    set({ sugestao });
  },

  inserirSugestao: (aoCrescer) => {
    const { sugestao, texto, tags } = get();
    if (!sugestao) return;

    if (sugestao.tags) {
      set({ tags: [...new Set([...tags, ...sugestao.tags])], sugestao: null, tagsTocadas: true });
    } else {
      set({ texto: `${texto}\n\n${sugestao.texto}`, sugestao: null, textoTocado: true });
    }

    aoCrescer();
  },

  descartarSugestao: () => set({ sugestao: null }),

  resetar: () => set({ ...ESTADO_INICIAL }),
}));
