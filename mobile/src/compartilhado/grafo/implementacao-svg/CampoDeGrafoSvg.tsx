import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useTema } from "@/compartilhado/tema";
import {
  avancarCampo,
  avancarParticulas,
  calcularLigacoes,
  criarCampo,
  criarParticulas,
  deveRecalcularLigacoes,
  nascerNo,
  opacidadeDaParticula,
  raioDoCampo,
  type NoAmbiente,
  type OpcoesDeCampo,
  type Particula,
} from "../fisica";
import { corDoTom } from "./tomDoNo";
import type { PropsDoCampoDeGrafo } from "../contrato";

const PARTICULAS_POR_RAJADA = 8;
// O campo é decoração de fundo: 30 quadros por segundo bastam para ele parecer
// vivo, e segurar esse ritmo evita gastar os 120 quadros do aparelho com o
// pano de fundo em vez do que o dedo está tocando.
const INTERVALO_DO_CAMPO_MS = 1000 / 30;

export function CampoDeGrafoSvg({ densidade, ligado, particulasLigadas, pulso, crescer }: PropsDoCampoDeGrafo) {
  const { cores } = useTema();
  const { width: largura, height: altura } = useWindowDimensions();

  const opcoes: OpcoesDeCampo = { largura, altura, quantidade: densidade, aleatorio: Math.random };
  const opcoesRef = useRef(opcoes);
  // Atualiza a ref depois de cada render (nunca durante) para que o loop e os
  // outros efeitos sempre leiam largura/altura/densidade atuais sem precisar
  // reiniciar a cada mudança.
  useEffect(() => {
    opcoesRef.current = opcoes;
  });

  const [nos, setNos] = useState<NoAmbiente[]>(() => criarCampo(opcoes));
  const [particulas, setParticulas] = useState<Particula[]>([]);
  const [ligacoes, setLigacoes] = useState<[number, number][]>([]);

  const nosRef = useRef(nos);
  useEffect(() => {
    nosRef.current = nos;
  }, [nos]);

  useEffect(() => {
    setNos(criarCampo(opcoesRef.current));
  }, [densidade, largura, altura]);

  // `requestAnimationFrame` no lugar do `setInterval` que estava aqui: no React
  // Native ele é agendado pelo Choreographer, então acompanha o vsync em vez de
  // acumular drift — era o drift que aparecia como judder num aparelho de 120 Hz.
  //
  // E não `useFrameCallback` do Reanimated: o plugin transforma aquele callback
  // em worklet, e este loop precisa chamar `setNos`/`setParticulas`, que são
  // dispatch de estado do React e só existem na thread de JS. Tentar isso
  // derruba a tela com "Tried to synchronously call a Remote Function".
  useEffect(() => {
    if (!ligado) return;

    let cancelado = false;
    let pedido = 0;
    let ultimoPasso = 0;
    let ultimoCalculoDeLigacoes = 0;

    const passo = (agora: number) => {
      if (cancelado) return;
      pedido = requestAnimationFrame(passo);

      if (agora - ultimoPasso < INTERVALO_DO_CAMPO_MS) return;
      ultimoPasso = agora;

      setNos((atuais) => avancarCampo(atuais, opcoesRef.current));
      setParticulas(avancarParticulas);

      // As ligações saem do caminho quente: são O(n²) — 1770 pares na densidade
      // padrão de 60 — e os nós andam devagar demais para justificar recalculá-las
      // a cada passo.
      if (deveRecalcularLigacoes(ultimoCalculoDeLigacoes, agora)) {
        ultimoCalculoDeLigacoes = agora;
        const { largura: larguraAtual, altura: alturaAtual } = opcoesRef.current;
        setLigacoes(calcularLigacoes(nosRef.current, raioDoCampo(larguraAtual, alturaAtual)));
      }
    };

    pedido = requestAnimationFrame(passo);

    return () => {
      cancelado = true;
      cancelAnimationFrame(pedido);
    };
  }, [ligado]);

  useEffect(() => {
    if (pulso === 0 || !particulasLigadas) return;
    setParticulas((anteriores) => [
      ...anteriores,
      ...criarParticulas(nosRef.current, PARTICULAS_POR_RAJADA, Math.random),
    ]);
  }, [pulso, particulasLigadas]);

  useEffect(() => {
    if (crescer === 0) return;
    setNos((atuais) => nascerNo(atuais, opcoesRef.current));
  }, [crescer]);

  if (!ligado) return null;

  return (
    <View
      testID="campo-de-grafo"
      style={[StyleSheet.absoluteFill, { opacity: 0.8, pointerEvents: "none" }]}
    >
      <Svg width={largura} height={altura}>
        {ligacoes.map(([a, b]) =>
          nos[a] && nos[b] ? (
            <Line
              key={`${a}-${b}`}
              x1={nos[a].x}
              y1={nos[a].y}
              x2={nos[b].x}
              y2={nos[b].y}
              stroke={cores.grafoLigacao}
              strokeWidth={1}
            />
          ) : null,
        )}
        {nos.map((no, indice) => (
          <Circle
            key={indice}
            cx={no.x}
            cy={no.y}
            r={no.raio * no.escala * (1 + Math.sin(no.fase) * 0.06)}
            fill={corDoTom(no.tom, cores)}
          />
        ))}
        {particulas.map((particula, indice) => (
          <Circle
            key={`particula-${indice}`}
            cx={particula.deX + (particula.paraX - particula.deX) * particula.progresso}
            cy={particula.deY + (particula.paraY - particula.deY) * particula.progresso}
            r={2.4}
            fill={cores.grafoNoSinal}
            opacity={opacidadeDaParticula(particula.progresso)}
          />
        ))}
      </Svg>
    </View>
  );
}
