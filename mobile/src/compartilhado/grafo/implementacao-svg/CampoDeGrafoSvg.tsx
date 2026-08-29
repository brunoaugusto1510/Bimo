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
  nascerNo,
  opacidadeDaParticula,
  raioDoCampo,
  type NoAmbiente,
  type OpcoesDeCampo,
  type Particula,
} from "../fisica";
import { corDoTom } from "./tomDoNo";
import type { PropsDoCampoDeGrafo } from "../contrato";

const QUADROS_POR_SEGUNDO = 30;
const PARTICULAS_POR_RAJADA = 8;

export function CampoDeGrafoSvg({ densidade, ligado, particulasLigadas, pulso, crescer }: PropsDoCampoDeGrafo) {
  const { cores } = useTema();
  const { width: largura, height: altura } = useWindowDimensions();

  const opcoes: OpcoesDeCampo = { largura, altura, quantidade: densidade, aleatorio: Math.random };
  const opcoesRef = useRef(opcoes);
  // Atualiza a ref depois de cada render (nunca durante) para que o
  // intervalo e os outros efeitos sempre leiam largura/altura/densidade
  // atuais sem precisar reiniciar a cada mudança.
  useEffect(() => {
    opcoesRef.current = opcoes;
  });

  const [nos, setNos] = useState<NoAmbiente[]>(() => criarCampo(opcoes));
  const [particulas, setParticulas] = useState<Particula[]>([]);

  const nosRef = useRef(nos);
  useEffect(() => {
    nosRef.current = nos;
  }, [nos]);

  useEffect(() => {
    setNos(criarCampo(opcoesRef.current));
  }, [densidade, largura, altura]);

  useEffect(() => {
    if (!ligado) return;
    const intervalo = setInterval(() => {
      setNos((atuais) => avancarCampo(atuais, opcoesRef.current));
      setParticulas(avancarParticulas);
    }, 1000 / QUADROS_POR_SEGUNDO);
    return () => clearInterval(intervalo);
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

  const raio = raioDoCampo(largura, altura);
  const ligacoes = calcularLigacoes(nos, raio);

  return (
    <View
      testID="campo-de-grafo"
      style={[StyleSheet.absoluteFill, { opacity: 0.8, pointerEvents: "none" }]}
    >
      <Svg width={largura} height={altura}>
        {ligacoes.map(([a, b]) => (
          <Line
            key={`${a}-${b}`}
            x1={nos[a].x}
            y1={nos[a].y}
            x2={nos[b].x}
            y2={nos[b].y}
            stroke={cores.grafoLigacao}
            strokeWidth={1}
          />
        ))}
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
