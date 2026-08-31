/* eslint-disable react-hooks/immutability -- O React Compiler modela todo valor
   criado no corpo do hook como imutável, mas o shared value do Reanimated é
   exatamente o oposto: uma caixa mutável de identidade estável, e mutá-la é a
   API oficial da biblioteca. A regra aceita mutar num efeito OU num callback,
   nunca nos dois — e é isso que este hook precisa fazer, porque a simulação é
   reiniciada por efeito (lista de notas nova) e mexida por gesto (nó pego). */
import { useEffect, useMemo, useState } from "react";
import { runOnJS, useFrameCallback, useSharedValue } from "react-native-reanimated";
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
  // Bandeira de "a simulação esfriou", levantada pelo worklet e consumida pela
  // reação abaixo — o caminho para desligar o loop de fora dele.
  const esfriada = useSharedValue(false);

  // Ligar/desligar o loop é decisão do JS, nunca do worklet. O objeto que o
  // `useFrameCallback` devolve guarda estado interno (`callbackId`,
  // `isActive`), e citá-lo dentro de um worklet o serializa — a partir daí
  // qualquer `setActive` reclama "Tried to modify key ... of an object which
  // has been already passed to a worklet". Os worklets só levantam a bandeira
  // por `runOnJS`; quem chama `setActive` é o efeito lá embaixo.
  const [ativo, setAtivo] = useState(true);

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

    // Grafo parado não merece quadros. O desligamento não acontece aqui
    // dentro: o worklet não pode referenciar `quadro`, que só existe depois
    // desta chamada — ele capturaria `undefined`. Levanta a bandeira e quem
    // desliga é a reação lá embaixo.
    //
    // É também o único momento em que vale gravar as posições: o layout só
    // está assentado aqui.
    if (esfriou(atual) && !esfriada.value) {
      esfriada.value = true;
      runOnJS(setAtivo)(false);
      if (aoEsfriar) runOnJS(aoEsfriar)(proximo.map((posicao) => ({ x: posicao.x, y: posicao.y })));
    }
  }, false);

  useEffect(() => {
    compartilhado.value = estado;
    posicoes.value = copiarPosicoes(estado);
    buffers.value = [copiarPosicoes(estado), copiarPosicoes(estado)];
    esfriada.value = false;
    // Liga direto, sem passar por `setAtivo`: aqui é a thread de JS, onde tocar
    // `quadro` é seguro, e um setState dentro de efeito dispararia um render em
    // cascata. `ativo` pode ficar em `false` enquanto o loop roda — o efeito
    // abaixo só reage a mudanças dele, então não desliga nada por conta própria,
    // e o próximo gesto ou resfriamento volta a sincronizar os dois.
    quadro.setActive(true);
    // Os shared values ficam fora das dependências de propósito: são estáveis
    // por construção (o Reanimated devolve sempre o mesmo objeto) e listá-los
    // faz o React Compiler tratá-los como valor de render, proibindo as
    // escritas que este hook precisa fazer nos gestos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, quadro]);

  useEffect(() => {
    quadro.setActive(ativo);
  }, [ativo, quadro]);

  return {
    posicoes,

    pegarNo: (id: string, x: number, y: number) => {
      "worklet";
      fixarNo(compartilhado.value, id, x, y);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
      esfriada.value = false;
      runOnJS(setAtivo)(true);
    },

    moverNoPego: (id: string, x: number, y: number) => {
      "worklet";
      fixarNo(compartilhado.value, id, x, y);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
      esfriada.value = false;
    },

    soltarNo: (id: string) => {
      "worklet";
      liberarNo(compartilhado.value, id);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
      esfriada.value = false;
      runOnJS(setAtivo)(true);
    },
  };
}
