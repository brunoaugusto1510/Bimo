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
  // Id da nota que este estado representa no momento — não faz parte da
  // interface pública descrita no brief, é bookkeeping interno de carregar()
  // para distinguir "terminando de carregar a nota já aberta" de "abrindo
  // uma nota diferente". Ver o comentário em carregar() abaixo.
  idCarregado: string | null;
  carregar: (nota: Nota | null) => void;
  definirTitulo: (titulo: string) => void;
  digitarTexto: (texto: string, aoCrescer: () => void) => void;
  abrirMenu: () => void;
  fecharMenu: () => void;
  rodarAcao: (ia: ServicoIA, tipo: TipoDeAcaoIA, nota: Nota, aoPulsar: () => void) => Promise<void>;
  inserirSugestao: (aoCrescer: () => void) => void;
  descartarSugestao: () => void;
  // Hygiene de teste: devolve o estado ao ponto de partida (inclusive
  // `idCarregado`), para que um `it` não vaze estado interno para o
  // próximo — carregar() sozinho não garante isso, veja o comentário lá.
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
};

export const useEstadoEditor = create<EstadoEditor>((set, get) => ({
  ...ESTADO_INICIAL,

  // CUIDADO — corrida de produção já encontrada aqui uma vez: `carregar()`
  // é chamado quando `vault.obterNota` resolve, de forma assíncrona. Se o
  // usuário roda uma ação da IA (rodarAcao) enquanto esse fetch ainda está
  // no ar, `sugestao` já teria um valor quando o fetch finalmente chega —
  // e um `carregar()` que sempre zera `sugestao`/`menuIA` apaga essa
  // sugestão que acabou de chegar, sem o usuário ter feito nada de errado.
  //
  // A correção: `carregar()` só zera `sugestao`/`menuIA` quando está de
  // fato trocando de nota (o `id` recebido é diferente do `idCarregado`
  // atual). Uma segunda chamada para a MESMA nota — o caso da Editor.tsx,
  // que chama `carregar()` de forma síncrona com um "casco" vazio ao abrir
  // a rota (fixando `idCarregado` antes do fetch sequer começar) e de novo
  // quando o fetch resolve — é tratada como "terminando de carregar a nota
  // que já está aberta": atualiza título/corpo/tags, mas não mexe em
  // `sugestao`/`menuIA`, porque quem quer que os tenha mudado nesse
  // intervalo tem prioridade sobre um load que só está pondo o conteúdo em
  // dia.
  carregar: (nota) => {
    const idNovo = nota?.id ?? null;
    const mesmaNotaJaAberta = idNovo !== null && idNovo === get().idCarregado;
    set({
      titulo: nota?.titulo ?? "",
      texto: nota?.corpo ?? "",
      tags: nota?.tags ?? [],
      idCarregado: idNovo,
      carregadosNoUltimoNo: nota?.corpo.length ?? 0,
      ...(mesmaNotaJaAberta ? {} : { menuIA: false, sugestao: null }),
    });
  },

  definirTitulo: (titulo) => set({ titulo }),

  digitarTexto: (texto, aoCrescer) => {
    const { carregadosNoUltimoNo } = get();
    const cresceu = texto.length - carregadosNoUltimoNo >= CARACTERES_POR_NO;
    set({ texto, carregadosNoUltimoNo: cresceu ? texto.length : carregadosNoUltimoNo });
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
      set({ tags: [...new Set([...tags, ...sugestao.tags])], sugestao: null });
    } else {
      set({ texto: `${texto}\n\n${sugestao.texto}`, sugestao: null });
    }

    aoCrescer();
  },

  descartarSugestao: () => set({ sugestao: null }),

  resetar: () => set({ ...ESTADO_INICIAL }),
}));
