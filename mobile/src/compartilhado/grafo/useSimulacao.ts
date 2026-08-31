import { useEffect, useMemo } from "react";
import { runOnJS, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import type { Posicao } from "./posicionamento";
import {
  avancarSimulacao,
  criarSimulacao,
  esfriou,
  fixarNo,
  liberarNo,
  reaquecer,
  type EstadoSimulacao,
} from "./simulacao";

export type { Posicao };

const ALPHA_AO_REAQUECER = 0.3;
const MILISSEGUNDOS_POR_QUADRO = 16.67;

type Opcoes = {
  nos: NoDoGrafo[];
  arestas: Aresta[];
  largura: number;
  altura: number;
  posicoesIniciais?: Record<string, Posicao>;
  // Chamado uma vez por resfriamento, na JS thread, com as posições finais na
  // mesma ordem de `nos`. É o gancho de gravação em disco.
  aoEsfriar?: (posicoes: Posicao[]) => void;
};

function copiarPosicoes(estado: EstadoSimulacao): Posicao[] {
  return estado.nos.map((no) => ({ x: no.x, y: no.y }));
}

export function useSimulacao({ nos, arestas, largura, altura, posicoesIniciais, aoEsfriar }: Opcoes) {
  const estado = useMemo(() => {
    const criado = criarSimulacao(nos, arestas, largura, altura);

    // Posição salva vence o layout circular; nota sem posição salva (nova, ou
    // com o registro descartado por versão) entra pelo círculo.
    if (posicoesIniciais) {
      for (const no of criado.nos) {
        const salva = posicoesIniciais[no.id];
        if (salva) {
          no.x = salva.x;
          no.y = salva.y;
        }
      }
    }

    return criado;
  }, [nos, arestas, largura, altura, posicoesIniciais]);

  const compartilhado = useSharedValue<EstadoSimulacao>(estado);
  const posicoes = useSharedValue<Posicao[]>(copiarPosicoes(estado));

  // Dois buffers pré-alocados, alternados a cada quadro: a troca de referência
  // é o que faz o Reanimated notificar os `useAnimatedProps`, e reaproveitar
  // os objetos é o que mantém o caminho quente sem alocação.
  const buffers = useSharedValue<[Posicao[], Posicao[]]>([copiarPosicoes(estado), copiarPosicoes(estado)]);
  const buffer = useSharedValue(0);

  const quadro = useFrameCallback((info) => {
    "worklet";
    const atual = compartilhado.value;
    avancarSimulacao(atual, info.timeSincePreviousFrame ?? MILISSEGUNDOS_POR_QUADRO);

    const proximo = buffers.value[buffer.value];
    for (let i = 0; i < atual.nos.length; i += 1) {
      proximo[i].x = atual.nos[i].x;
      proximo[i].y = atual.nos[i].y;
    }
    posicoes.value = proximo;
    buffer.value = buffer.value === 0 ? 1 : 0;

    // Grafo parado não merece quadros: o loop se desliga sozinho e volta
    // quando algo o reaquece. É também o único momento em que vale gravar as
    // posições — o layout só está assentado aqui.
    if (esfriou(atual)) {
      quadro.setActive(false);
      if (aoEsfriar) runOnJS(aoEsfriar)(proximo.map((posicao) => ({ x: posicao.x, y: posicao.y })));
    }
  }, false);

  useEffect(() => {
    compartilhado.value = estado;
    posicoes.value = copiarPosicoes(estado);
    buffers.value = [copiarPosicoes(estado), copiarPosicoes(estado)];
    quadro.setActive(true);
  }, [estado, compartilhado, posicoes, buffers, quadro]);

  return {
    posicoes,

    pegarNo: (id: string, x: number, y: number) => {
      "worklet";
      fixarNo(compartilhado.value, id, x, y);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
      quadro.setActive(true);
    },

    moverNoPego: (id: string, x: number, y: number) => {
      "worklet";
      fixarNo(compartilhado.value, id, x, y);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
    },

    soltarNo: (id: string) => {
      "worklet";
      liberarNo(compartilhado.value, id);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
    },
  };
}
